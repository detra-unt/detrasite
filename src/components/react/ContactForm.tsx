import { useState, useEffect, useRef } from 'react';
import emailjs from '@emailjs/browser';

// ─── EmailJS credentials ──────────────────
const EMAILJS_PUBLIC_KEY = "QWFVMY56nLoAU0N86";
const EMAILJS_SERVICE_ID = "service_go2sg9l";
const EMAILJS_TEMPLATE_ID = "template_82l7ns5";

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

  const formRef = useRef<HTMLFormElement>(null);

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
      // Shake animation
      if (formRef.current) {
        formRef.current.classList.add('shake');
        formRef.current.addEventListener(
          'animationend',
          () => formRef.current?.classList.remove('shake'),
          { once: true }
        );
      }
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

  // ── Field class helper ────────────────────
  const fieldClass = (field: string, value: string) => {
    if (errors[field]) return 'contact-field is-invalid';
    if (value) return 'contact-field is-valid';
    return 'contact-field';
  };

  // ── Clear error on input ──────────────────
  const clearErrorOnInput = (field: string, value: string) => {
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
    <div className="contact-card">
      {/* Error banner */}
      {status === 'error' && (
        <div className="contact-error" role="alert">
          <span className="material-symbols-outlined text-base shrink-0">error</span>
          <p className="text-sm font-body">
            Hubo un error al enviar. Por favor inténtalo de nuevo.
          </p>
        </div>
      )}

      {/* Success state */}
      {status === 'success' ? (
        <div className="contact-success" aria-live="polite">
          <span
            className="contact-success__icon material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            check_circle
          </span>
          <h3 className="contact-success__title">¡Mensaje enviado!</h3>
          <p className="contact-success__body">
            Nos pondremos en contacto contigo a la brevedad.
          </p>
          <button
            onClick={handleReset}
            className="contact-success__reset"
            type="button"
          >
            Enviar otro mensaje
          </button>
        </div>
      ) : (
        <form
          ref={formRef}
          className="contact-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Formulario de contacto"
        >
          {/* Name + Email row */}
          <div className="contact-form__row">
            {/* Name */}
            <div className={fieldClass('nombre', nombre)} id="field-nombre">
              <label htmlFor="nombre" className="contact-field__label">
                Nombre completo
              </label>
              <input
                id="nombre"
                name="from_name"
                type="text"
                placeholder="Tu nombre"
                autoComplete="name"
                className="contact-field__input"
                aria-describedby="error-nombre"
                minLength={2}
                required
                value={nombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  clearErrorOnInput('nombre', e.target.value);
                }}
              />
              <span className="contact-field__bar" aria-hidden="true"></span>
              <span id="error-nombre" className="contact-field__error" role="alert">
                {errors.nombre || ''}
              </span>
            </div>

            {/* Email */}
            <div className={fieldClass('email', email)} id="field-email">
              <label htmlFor="email" className="contact-field__label">
                Correo electrónico
              </label>
              <input
                id="email"
                name="from_email"
                type="email"
                placeholder="ejemplo@correo.com"
                autoComplete="email"
                className="contact-field__input"
                aria-describedby="error-email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearErrorOnInput('email', e.target.value);
                }}
              />
              <span className="contact-field__bar" aria-hidden="true"></span>
              <span id="error-email" className="contact-field__error" role="alert">
                {errors.email || ''}
              </span>
            </div>
          </div>

          {/* Custom Subject Dropdown */}
          <div className={fieldClass('asunto', asunto)} id="field-asunto">
            <label id="asunto-label" className="contact-field__label">
              Asunto
            </label>
            {/* Hidden input for form data */}
            <input type="hidden" id="asunto-value" name="subject" value={asunto} />
            {/* Custom trigger */}
            <button
              type="button"
              id="asunto-trigger"
              className={`contact-field__input cselect-trigger${isDropdownOpen ? ' is-open' : ''}${asunto ? ' has-value' : ''}`}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              aria-labelledby="asunto-label"
              aria-describedby="error-asunto"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="cselect-trigger__text">
                {asunto || 'Selecciona un asunto'}
              </span>
              <svg
                className="cselect-trigger__chevron"
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
              className={`cselect-list${isDropdownOpen ? ' is-open' : ''}`}
              role="listbox"
              aria-labelledby="asunto-label"
              aria-hidden={!isDropdownOpen}
            >
              {SUBJECTS.map((subject, i) => (
                <li
                  key={subject}
                  className={`cselect-option${asunto === subject ? ' is-selected' : ''}`}
                  role="option"
                  aria-selected={asunto === subject}
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
                    className="cselect-option__check material-symbols-outlined"
                    aria-hidden="true"
                  >
                    check
                  </span>
                  {subject}
                </li>
              ))}
            </ul>
            <span className="contact-field__bar" aria-hidden="true"></span>
            <span id="error-asunto" className="contact-field__error" role="alert">
              {errors.asunto || ''}
            </span>
          </div>

          {/* Message */}
          <div className={fieldClass('mensaje', mensaje)} id="field-mensaje">
            <label htmlFor="mensaje" className="contact-field__label">
              Mensaje
            </label>
            <textarea
              id="mensaje"
              name="message"
              placeholder="Escribe tu mensaje aquí…"
              rows={4}
              className="contact-field__input contact-field__textarea"
              aria-describedby="error-mensaje"
              minLength={10}
              required
              value={mensaje}
              onChange={(e) => {
                setMensaje(e.target.value);
                clearErrorOnInput('mensaje', e.target.value);
              }}
            ></textarea>
            <span className="contact-field__bar" aria-hidden="true"></span>
            <span id="error-mensaje" className="contact-field__error" role="alert">
              {errors.mensaje || ''}
            </span>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="contact-submit"
            disabled={status === 'loading'}
          >
            <span>{status === 'loading' ? 'Enviando…' : 'Enviar mensaje'}</span>
            {status !== 'loading' && (
              <span
                className="contact-submit__icon material-symbols-outlined"
                aria-hidden="true"
              >
                send
              </span>
            )}
            {status === 'loading' && (
              <svg
                className="contact-submit__spinner"
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
