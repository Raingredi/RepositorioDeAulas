// global/alert-modals.js
export function showSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  
  export function hideSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  
  export function showErrorModal(message) {
    const modal = document.getElementById('errorModal');
    const msg = document.getElementById('errorModalMessage');
    msg.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  
  export function hideErrorModal() {
    const modal = document.getElementById('errorModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  