import "cesium/Build/Cesium/Widgets/widgets.css";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/500.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-semi-condensed/500.css";
import "@fontsource/barlow-semi-condensed/600.css";
import "./style.css";
import "./cesiumAccessToken.js";

import { mount } from "svelte";
import App from "./App.svelte";

mount(App, { target: document.getElementById("app") });
