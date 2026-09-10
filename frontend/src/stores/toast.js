import { reactive } from 'vue';

const state = reactive({
  toasts: []
});

let nextId = 1;

export const useToast = () => {
  const show = (message, type = 'info', duration = 3500) => {
    const id = nextId++;
    const toast = { id, message, type };
    state.toasts.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        remove(id);
      }, duration);
    }
    return id;
  };

  const success = (msg, duration = 3500) => show(msg, 'success', duration);
  const error = (msg, duration = 4500) => show(msg, 'error', duration);
  const info = (msg, duration = 3500) => show(msg, 'info', duration);
  const warning = (msg, duration = 4000) => show(msg, 'warning', duration);

  const remove = (id) => {
    const idx = state.toasts.findIndex((t) => t.id === id);
    if (idx !== -1) {
      state.toasts.splice(idx, 1);
    }
  };

  return {
    toasts: state.toasts,
    show,
    success,
    error,
    info,
    warning,
    remove
  };
};
