// Lets plain `tsc` (TS 7) resolve .vue imports; vue-tsc checks .vue content itself.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
