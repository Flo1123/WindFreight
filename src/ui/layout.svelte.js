// compact layout for phones and half-width windows; the same query is used in the components' CSS
const query = window.matchMedia("(max-width: 900px), (max-height: 560px)");

export const layout = $state({ compact: query.matches });

query.addEventListener("change", (event) => {
  layout.compact = event.matches;
});

// px from each screen edge that the HUD panels cover; App.svelte measures it, ship.showRoute() keeps the route out of it
export const hud = {
  insets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
};
