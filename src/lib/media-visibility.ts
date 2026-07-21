export function shouldRenderVideo(collapsed: boolean, visibility: DocumentVisibilityState): boolean {
  return !collapsed && visibility === "visible";
}

export function currentDocumentVisibility(): DocumentVisibilityState {
  return typeof document === "undefined" ? "hidden" : document.visibilityState;
}
