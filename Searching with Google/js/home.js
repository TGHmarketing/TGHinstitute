let state = JSON.parse(localStorage.getItem('quizstatus'));
if (!state) {
  state = [];
  localStorage.setItem('quizstatus', JSON.stringify(state));
}

let units = [
  "browsing", "passwords",
  "compemail", "socialmedia"
];

let stagger = 0;
document.body.classList.add("moving");
for (let i in units) {
  let id = "mod_" + units[i];
  let section = document.getElementById(id);
  let button = section.querySelector('.startbutton');
  section.classList.add("ready");
  button.setAttribute('data-id', id);
  if (state.includes(id)) {
    section.classList.add("completed");
    button.innerHTML = "Review";
  }
  setTimeout(() => {
    section.classList.remove("ready");
    section.classList.add("enter");
  }, stagger);
  stagger += 300;
}

setTimeout(() => {
  document.body.classList.remove("moving");
}, stagger + 300);

function resized() {
  let modals = document.getElementsByClassName('docheight');
  for(i = 0; i < modals.length; i++) {
    let modal = modals[i];
    modal.style.height = (parseInt(window.getComputedStyle(document.body).height) + 38) + "px";
  }
}
window.addEventListener('resize', resized);
resized();

let creditlink = document.getElementById('showcredits');
let creditmodal = document.getElementById('creditmodal');
creditlink.addEventListener('click', () => {
  creditmodal.classList.remove('hidden');
});
creditmodal.addEventListener('click', () => {
  creditmodal.classList.add('hidden');
});
