import { createApp } from "/vendor/.vite-deps-vue.js__v--05447b4d.js";
import App from "/src/content/views/App.vue.js";
console.log("[CRXJS] Hello world from content script!");
function mountApp() {
  const container = document.createElement("div");
  container.id = "crxjs-app";
  document.body.appendChild(container);
  const app = createApp(App);
  app.mount(container);
}
mountApp();
