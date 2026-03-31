import { useState, useEffect } from 'react';
import emailjs from '@emailjs/browser';
import styles from './ContactForm.module.css';

// ─── EmailJS credentials ──────────────────
const EMAILJS_PUBLIC_KEY = import.meta.env.PUBLIC_EMAILJS_PUBLIC_KEY
const EMAILJS_SERVICE_ID = import.meta.env.PUBLIC_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.PUBLIC_EMAILJS_TEMPLATE_ID;

// ─── Subjects ─────────────────────────────
const SUBJECTS = [
  "Consulta general",
  "Propuesta de colaboración",
  "Información sobre la revista",
  "Proceso de admisión",
  "Otro",
];

// ─── Validation ───────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ContactForm() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [asunto, setAsunto] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [shake, setShake] = useState(false);

  // ── Effect 1: Initialize EmailJS ──────────
  useEffect(() => {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }, []);

  // ── Effect 2 Definitivo: Autocompletar desde url (motivos dinámicos) ──
  useEffect(() => {
    //Paso 1 : Definir el diccionario de motivos
    const PREFILL_CONFIG: Record<string, { asunto: string, mensaje: string }> = {
      revista: {
        asunto: 'Información sobre la revista',
        mensaje: 'Hola, me gustaría mas información sobre cómo adquirir la revista. Quedo atento a su respuesta'
      },
      contacto: {
        asunto: 'Consulta general',
        mensaje: 'Hola quisiera ponerme en contacto con ustedes. Estaré al tanto de su respuesta.'
      },
      colaboracion: {
        asunto: 'Propuesta de colaboración',
        mensaje: 'Hola, me gustaría recibir más información sobre los lineamientos y requisitos para colaborar con un artículo de investigación. Quedo a la espera de sus indicaciones.'
      },
      //Permite la integración de más motivos
    }

    const checkMotive = () => {
      //Paso 2 : Extraer el motivo de la URL (ya sea de los parámetros o del hash)
      const searchParams = new URLSearchParams(window.location.search);
      let motivo = searchParams.get('motivo');

      if (!motivo) {
        // Expresión regular para extraer el motivo del hash si viene como #contacto?motivo=revista
        const hashMatch = window.location.hash.match(/motivo=([^&]+)/);
        if (hashMatch) motivo = hashMatch[1];
      }

      //Paso 3: Verificación de la existencia del motivo dentro del diccionario definido en el paso 1
      if (motivo && PREFILL_CONFIG[motivo]) {
        const { asunto: nuevoAsunto, mensaje: nuevoMensaje } = PREFILL_CONFIG[motivo];
        //Paso 4: Actualizar los estados
        setAsunto(nuevoAsunto);
        setMensaje(prev => (prev || nuevoMensaje));
        setErrors(prev => ({ ...prev, asunto: '', mensaje: '' }));
        //Paso 5: Limpiar la URL de manera general
        const cleanUrl = window.location.pathname + window.location.hash.split('?')[0];
        window.history.replaceState({}, '', cleanUrl);
      }
    };

    //Ejecutar el montar y cambiar el hash
    checkMotive();
    window.addEventListener('hashchange', checkMotive);
    return () => window.removeEventListener('hashchange', checkMotive);
  }, []);

  // ── Effect 3: Cerrar dropdown al hacer click fuera ──
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#field-asunto')) setIsDropdownOpen(false);
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isDropdownOpen]);

  // ── Validation ────────────────────────────
  function validateForm(): boolean {
    const newErrors: Record<string, string> = {};

    if (nombre.trim().length < 2) {
      newErrors.nombre = 'Ingresa tu nombre completo.';
    }
    if (!email.trim()) {
      newErrors.email = 'El correo es obligatorio.';
    } else if (!EMAIL_RE.test(email.trim())) {
      newErrors.email = 'Ingresa un correo válido.';
    }
    if (!asunto.trim()) {
      newErrors.asunto = 'Selecciona un asunto.';
    }
    if (mensaje.trim().length < 10) {
      newErrors.mensaje = 'El mensaje debe tener al menos 10 caracteres.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ── Submit ────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      // Animación shake controlada por estado React
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    setStatus('loading');
    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        from_name: nombre,
        from_email: email,
        subject: asunto,
        message: mensaje,
      });
      setStatus('success');
    } catch (err) {
      console.error('EmailJS error:', err);
      setStatus('error');
    }
  };

  // ── Reset ─────────────────────────────────
  const handleReset = () => {
    setNombre('');
    setEmail('');
    setAsunto('');
    setMensaje('');
    setErrors({});
    setStatus('idle');
    setIsDropdownOpen(false);
  };

  // ── Field class helper (CSS Modules) ──────
  const fieldClass = (field: string, value: string, extraClass?: string) => {
    const classes = [styles.field];
    if (extraClass) classes.push(extraClass);
    if (errors[field]) classes.push(styles.fieldInvalid);
    else if (value) classes.push(styles.fieldValid);
    return classes.join(' ');
  };

  // ── Clear error on input ──────────────────
  const clearErrorOnInput = (field: string, _value: string) => {
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // ── Render ────────────────────────────────
  return (
    <div className={styles.card}>
      {/* Error banner */}
      {status === 'error' && (
        <div className={styles.error} role="alert">
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <p className="text-sm font-body">
            Hubo un error al enviar. Por favor inténtalo de nuevo.
          </p>
        </div>
      )}

      {/* Success state */}
      {status === 'success' ? (
        <div className={styles.success} aria-live="polite">
          <span
            className={`${styles.successIcon} material-symbols-outlined`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h3 className={styles.successTitle}>¡Mensaje enviado!</h3>
          <p className={styles.successBody}>
            Nos pondremos en contacto contigo a la brevedad.
          </p>
          <button
            onClick={handleReset}
            className={styles.successReset}
            type="button"
          >
            Enviar otro mensaje
          </button>
        </div>
      ) : (
        <form
          className={`${styles.form}${shake ? ` ${styles.formShake}` : ''}`}
          onSubmit={handleSubmit}
          noValidate
          aria-label="Formulario de contacto"
        >
          {/* Name + Email row */}
          <div className={styles.formRow}>
            {/* Name */}
            <div className={fieldClass('nombre', nombre)} id="field-nombre">
              <label htmlFor="nombre" className={styles.fieldLabel}>
                Nombre completo
              </label>
              <input
                id="nombre"
                name="from_name"
                type="text"
                placeholder="Tu nombre"
                autoComplete="name"
                className={styles.fieldInput}
                aria-describedby="error-nombre"
                minLength={2}
                required
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  clearErrorOnInput('nombre', e.target.value);
                }}
              />
              <span className={styles.fieldBar} aria-hidden="true"></span>
              <span id="error-nombre" className={styles.fieldError} role="alert">
                {errors.nombre || ''}
              </span>
            </div>

            {/* Email */}
            <div className={fieldClass('email', email)} id="field-email">
              <label htmlFor="email" className={styles.fieldLabel}>
                Correo electrónico
              </label>
              <input
                id="email"
                name="from_email"
                type="email"
                placeholder="ejemplo@correo.com"
                autoComplete="email"
                className={styles.fieldInput}
                aria-describedby="error-email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearErrorOnInput('email', e.target.value);
                }}
              />
              <span className={styles.fieldBar} aria-hidden="true"></span>
              <span id="error-email" className={styles.fieldError} role="alert">
                {errors.email || ''}
              </span>
            </div>
          </div>

          {/* Custom Subject Dropdown */}
          <div 
            className={fieldClass('asunto', asunto, styles.fieldAsunto)} 
            id="field-asunto"
          >
            <label id="asunto-label" className={styles.fieldLabel}>
              Asunto
            </label>
            {/* Hidden input for form data */}
            <input type="hidden" id="asunto-value" name="subject" value={asunto} />
            {/* Custom trigger */}
            <button
              type="button"
              id="asunto-trigger"
              className={`${styles.fieldInput} ${styles.selectTrigger}${isDropdownOpen ? ` ${styles.selectTriggerOpen}` : ''}${asunto ? ` ${styles.selectTriggerHasValue}` : ''}`}
              aria-haspopup="true"
              aria-expanded={isDropdownOpen}
              aria-labelledby="asunto-label"
              aria-describedby="error-asunto"
              aria-controls="asunto-listbox"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className={styles.selectTriggerText}>
                {asunto || 'Selecciona un asunto'}
              </span>
              <svg
                className={styles.selectTriggerChevron}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            {/* Dropdown panel */}
            <ul
              id="asunto-listbox"
              className={`${styles.selectList}${isDropdownOpen ? ` ${styles.selectListOpen}` : ''}`}
              role="listbox"
              aria-labelledby="asunto-label"
              aria-hidden={isDropdownOpen ? 'false' : 'true'}
            >
              {SUBJECTS.map((subject, i) => (
                <li
                  key={subject}
                  className={`${styles.selectOption}${asunto === subject ? ` ${styles.selectOptionSelected}` : ''}`}
                  role="option"
                  aria-selected={asunto === subject ? 'true' : 'false'}
                  data-value={subject}
                  id={`asunto-opt-${i}`}
                  tabIndex={-1}
                  onClick={() => {
                    setAsunto(subject);
                    setIsDropdownOpen(false);
                    setErrors(prev => ({ ...prev, asunto: '' }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setAsunto(subject);
                      setIsDropdownOpen(false);
                      setErrors(prev => ({ ...prev, asunto: '' }));
                    }
                    if (e.key === 'Escape') {
                      setIsDropdownOpen(false);
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      const next = (e.target as HTMLElement).nextElementSibling as HTMLElement | null;
                      next?.focus();
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      const prev = (e.target as HTMLElement).previousElementSibling as HTMLElement | null;
                      prev?.focus();
                    }
                  }}
                >
                  <span
                    className={`${styles.selectOptionCheck} material-symbols-outlined`}
                    aria-hidden="true"
                  >
                    check
                  </span>
                  {subject}
                </li>
              ))}
            </ul>
            <span className={styles.fieldBar} aria-hidden="true"></span>
            <span id="error-asunto" className={styles.fieldError} role="alert">
              {errors.asunto || ''}
            </span>
          </div>

          {/* Message */}
          <div className={fieldClass('mensaje', mensaje)} id="field-mensaje">
            <label htmlFor="mensaje" className={styles.fieldLabel}>
              Mensaje
            </label>
            <textarea
              id="mensaje"
              name="message"
              placeholder="Escribe tu mensaje aquí…"
              rows={4}
              className={`${styles.fieldInput} ${styles.fieldTextarea}`}
              aria-describedby="error-mensaje"
              minLength={10}
              required
              value={mensaje}
              onChange={(e) => {
                setMensaje(e.target.value);
                clearErrorOnInput('mensaje', e.target.value);
              }}
            ></textarea>
            <span className={styles.fieldBar} aria-hidden="true"></span>
            <span id="error-mensaje" className={styles.fieldError} role="alert">
              {errors.mensaje || ''}
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submit}
            disabled={status === 'loading'}
          >
            <span>{status === 'loading' ? 'Enviando…' : 'Enviar mensaje'}</span>
            {status !== 'loading' && (
              <span
                className={`${styles.submitIcon} material-symbols-outlined`}
                aria-hidden="true"
              >
                send
              </span>
            )}
            {status === 'loading' && (
              <svg
                className={styles.submitSpinner}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-label="Enviando…"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
