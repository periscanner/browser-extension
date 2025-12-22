import { createHotContext as __vite__createHotContext } from "/vendor/vite-client.js";import.meta.hot = __vite__createHotContext("/src/content/views/App.vue.js");import { defineComponent as _defineComponent } from "/vendor/.vite-deps-vue.js__v--05447b4d.js";
import Logo from "/src/assets/crx.svg__import.js";
import { ref } from "/vendor/.vite-deps-vue.js__v--05447b4d.js";
const _sfc_main = /* @__PURE__ */ _defineComponent({
  __name: "App",
  setup(__props, { expose: __expose }) {
    __expose();
    const show = ref(false);
    const toggle = () => show.value = !show.value;
    const __returned__ = { show, toggle, get Logo() {
      return Logo;
    } };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});
import { createElementVNode as _createElementVNode, vShow as _vShow, normalizeClass as _normalizeClass, withDirectives as _withDirectives, openBlock as _openBlock, createElementBlock as _createElementBlock } from "/vendor/.vite-deps-vue.js__v--05447b4d.js";
const _hoisted_1 = { class: "popup-container" };
const _hoisted_2 = ["src"];
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _openBlock(), _createElementBlock("div", _hoisted_1, [
    _withDirectives(_createElementVNode(
      "div",
      {
        class: _normalizeClass(["popup-content", $setup.show ? "opacity-100" : "opacity-0"])
      },
      [..._cache[1] || (_cache[1] = [
        _createElementVNode(
          "h1",
          null,
          "HELLO CRXJS",
          -1
          /* CACHED */
        )
      ])],
      2
      /* CLASS */
    ), [
      [_vShow, $setup.show]
    ]),
    _createElementVNode("button", {
      class: "toggle-button",
      onClick: _cache[0] || (_cache[0] = ($event) => $setup.toggle())
    }, [
      _createElementVNode("img", {
        src: $setup.Logo,
        alt: "CRXJS logo",
        class: "button-icon"
      }, null, 8, _hoisted_2)
    ])
  ]);
}
import "/src/content/views/App.vue__vue_type--style_index--0_scoped--ce0f0a9b_lang.css.js";
_sfc_main.__hmrId = "ce0f0a9b";
typeof __VUE_HMR_RUNTIME__ !== "undefined" && __VUE_HMR_RUNTIME__.createRecord(_sfc_main.__hmrId, _sfc_main);
import.meta.hot.on("file-changed", ({ file }) => {
  __VUE_HMR_RUNTIME__.CHANGED_FILE = file;
});
import.meta.hot.accept((mod) => {
  if (!mod) return;
  const { default: updated, _rerender_only } = mod;
  if (_rerender_only) {
    __VUE_HMR_RUNTIME__.rerender(updated.__hmrId, updated.render);
  } else {
    __VUE_HMR_RUNTIME__.reload(updated.__hmrId, updated);
  }
});
import _export_sfc from "/vendor/id-__x00__plugin-vue:export-helper.js";
export default /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-ce0f0a9b"], ["__file", "/home/luispacx/code/periscanner/browser-extension/src/content/views/App.vue"]]);
