// Validación de campos vacíos en formularios
window.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', e => {
            const inputs = form.querySelectorAll('input[required], textarea[required]');
            for (const input of inputs) {
                if (input.value.trim() === '') {
                    e.preventDefault();
                    alert('Por favor, complete todos los campos obligatorios.');
                    input.focus();
                    return false;
                }
            }
        });
    });
});
