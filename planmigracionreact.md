## 📋 Plan de Migración: NewsletterCTA → React

---

### Paso 1: Crear el componente `ContactForm.tsx`

Crea el archivo `src/components/react/ContactForm.tsx` (crea la carpeta si no existe).

**Estados a definir con `useState`:**
- `nombre: string` — valor del campo nombre
- `email: string` — valor del campo email
- `asunto: string` — valor del asunto seleccionado
- `mensaje: string` — valor del textarea
- `status: 'idle' | 'loading' | 'success' | 'error'`
- `errors: Record<string, string>` — mensajes de error por campo
- `isDropdownOpen: boolean` — controla la visibilidad del select personalizado

**Constante de asuntos** (mover aquí desde el `.astro`):
```tsx
const SUBJECTS = [
  "Consulta general",
  "Propuesta de colaboración",
  "Información sobre la revista",
  "Proceso de admisión",
  "Otro",
];
```

**Credenciales de EmailJS** (mover aquí desde el `.astro`):
```tsx
const EMAILJS_PUBLIC_KEY = "QWFVMY56nLoAU0N86";
const EMAILJS_SERVICE_ID = "service_go2sg9l";
const EMAILJS_TEMPLATE_ID = "template_82l7ns5";
```

---

### Paso 2: Implementar los `useEffect`

**Efecto 1 — Inicialización de EmailJS** (ejecutar una sola vez al montar):
```tsx
useEffect(() => {
  emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
}, []);
```

**Efecto 2 — Autocompletado desde el footer** (traducción de `checkRevistaMotive`):

Al montar el componente, leer `window.location.search` y `window.location.hash`. Si cualquiera de los dos contiene `motivo=revista`:
- Setear `asunto` a `"Información sobre la revista"`
- Setear `mensaje` a `"Hola, me gustaría más información sobre cómo adquirir la revista. Quedo atento a su respuesta"`
- Limpiar el parámetro de la URL con `window.history.replaceState({}, '', window.location.pathname + window.location.hash.split('?')[0])`

También añadir un listener `hashchange` para el mismo efecto con su respectivo cleanup:
```tsx
useEffect(() => {
  const check = () => { /* lógica de checkRevistaMotive */ };
  check(); // ejecutar al montar
  window.addEventListener('hashchange', check);
  return () => window.removeEventListener('hashchange', check);
}, []);
```

---

### Paso 3: Implementar la validación

Crear la función `validateForm()` que retorne `boolean` y actualice el estado `errors`. Aplicar las mismas reglas que existían en el archivo original:

- `nombre`: mínimo 2 caracteres
- `email`: no vacío + regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- `asunto`: no vacío
- `mensaje`: mínimo 10 caracteres

Si hay errores, actualizar `errors` y retornar `false`. Si todo es válido, limpiar `errors` y retornar `true`.

---

### Paso 4: Implementar `handleSubmit`

```tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!validateForm()) return;

  setStatus('loading');
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      from_name: nombre,
      from_email: email,
      subject: asunto,
      message: mensaje,
    });
    setStatus('success');
  } catch {
    setStatus('error');
  }
};
```

---

### Paso 5: Implementar `handleReset`

Función para el botón "Enviar otro mensaje":
```tsx
const handleReset = () => {
  setNombre('');
  setEmail('');
  setAsunto('');
  setMensaje('');
  setErrors({});
  setStatus('idle');
  setIsDropdownOpen(false);
};
```

---

### Paso 6: Migrar el marcado HTML a JSX

Copiar la estructura de `<div class="contact-card">...</div>` del `.astro` original al `return` del componente React, aplicando los siguientes cambios:

- Todos los `class=` → `className=`
- Todos los `for=` → `htmlFor=`
- Cerrar etiquetas sueltas: `<input />`, `<span />`, etc.
- Eliminar los atributos `hidden` hardcodeados de los bloques de éxito y error

**Inputs controlados:**
```tsx
<input value={nombre} onChange={(e) => setNombre(e.target.value)} ... />
<input value={email} onChange={(e) => setEmail(e.target.value)} ... />
<textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} ... />
```

**Mostrar errores por campo** — en cada campo, si `errors.nombre` (o el campo correspondiente) existe, añadir la clase `is-invalid` al wrapper y renderizar el mensaje:
```tsx
<div className={`contact-field ${errors.nombre ? 'is-invalid' : nombre ? 'is-valid' : ''}`}>
  ...
  <span className="contact-field__error">{errors.nombre}</span>
</div>
```

**Custom Select (dropdown)** — reemplazar toda la lógica DOM por JSX puro:
```tsx
{/* Trigger */}
<button
  type="button"
  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
  className={`contact-field__input cselect-trigger ${isDropdownOpen ? 'is-open' : ''} ${asunto ? 'has-value' : ''}`}
>
  <span className="cselect-trigger__text">
    {asunto || 'Selecciona un asunto'}
  </span>
  {/* SVG del chevron */}
</button>

{/* Lista */}
<ul
  className={`cselect-list ${isDropdownOpen ? 'is-open' : ''}`}
  role="listbox"
>
  {SUBJECTS.map((subject) => (
    <li
      key={subject}
      className={`cselect-option ${asunto === subject ? 'is-selected' : ''}`}
      role="option"
      aria-selected={asunto === subject}
      onClick={() => {
        setAsunto(subject);
        setIsDropdownOpen(false);
        // limpiar error de asunto si existía
        setErrors(prev => ({ ...prev, asunto: '' }));
      }}
    >
      <span className="cselect-option__check material-symbols-outlined">check</span>
      {subject}
    </li>
  ))}
</ul>
```

Añadir un `useEffect` para cerrar el dropdown al hacer click fuera:
```tsx
useEffect(() => {
  if (!isDropdownOpen) return;
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('#field-asunto')) setIsDropdownOpen(false);
  };
  document.addEventListener('click', handleClick);
  return () => document.removeEventListener('click', handleClick);
}, [isDropdownOpen]);
```

**Renderizado condicional del formulario completo:**
```tsx
return (
  <div className="contact-card">
    {/* Banner de error */}
    {status === 'error' && (
      <div className="contact-error" role="alert">
        <span className="material-symbols-outlined text-base shrink-0">error</span>
        <p className="text-sm font-body">Hubo un error al enviar. Por favor inténtalo de nuevo.</p>
      </div>
    )}

    {/* Estado de éxito */}
    {status === 'success' ? (
      <div className="contact-success">
        {/* icono, título, descripción */}
        <button onClick={handleReset} className="contact-success__reset" type="button">
          Enviar otro mensaje
        </button>
      </div>
    ) : (
      <form className="contact-form" onSubmit={handleSubmit} noValidate>
        {/* campos aquí */}

        {/* Botón submit */}
        <button
          type="submit"
          className="contact-submit"
          disabled={status === 'loading'}
        >
          <span>{status === 'loading' ? 'Enviando…' : 'Enviar mensaje'}</span>
          {status !== 'loading' && (
            <span className="contact-submit__icon material-symbols-outlined">send</span>
          )}
          {status === 'loading' && (
            <svg className="contact-submit__spinner" /* ... */ />
          )}
        </button>
      </form>
    )}
  </div>
);
```

---

### Paso 7: Actualizar `NewsletterCTA.astro`

1. **Importar el componente React** al inicio del frontmatter:
```astro
import ContactForm from './react/ContactForm';
```

2. **Eliminar** todo el bloque `<div class="contact-card">...</div>` del HTML.

3. **Eliminar** la etiqueta `<script>` completa del final del archivo.

4. **Eliminar** la etiqueta `<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/...">` del CDN ya que ahora se usa el paquete npm.

5. **Insertar el componente** en el lugar donde estaba el formulario:
```astro
<ContactForm client:load />
```
Usar `client:load` y **no** `client:visible` para garantizar que el autocompletado del motivo revista funcione correctamente desde el primer render.

6. **Cambiar el tag de estilos** de `<style>` a `<style is:global>` — esto es obligatorio porque los estilos de Astro son scoped por defecto y no alcanzarán los elementos renderizados por el componente React. Sin este cambio, todo el diseño del formulario se romperá.