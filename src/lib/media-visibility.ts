export function shouldRenderVideo(collapsed: boolean, visibility: DocumentVisibilityState): boolean {
  return !collapsed && visibility === "visible";
}
