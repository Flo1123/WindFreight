# WindFreight

**Try it: [windfreight.netlify.app](https://windfreight.netlify.app)**

I built this simulation for the Matura thesis "Kites als Antriebshilfe bei Frachtschiffen" (Gymnasium Burgdorf, 2024).

A container ship sails a real sea route on a 3D globe. Real wind data from January 2024 decides when a large towing kite can fly and how hard it pulls. Along the way the simulation adds up how much fuel and CO₂ the kite saves.

What came out of it: a kite is worth it, but it's no miracle. On most routes it saves a few percent of the fuel, on smaller ships with good wind up to around 20 %. Bigger ships save about the same amount of fuel in tonnes, but it's a smaller share of what they burn.

## Data sources

- **Wind:** [NOAA Global Forecast System](https://www.ncei.noaa.gov/products/weather-climate-models/global-forecast), January 2024, every 6 hours
- **Sea routes:** [Searoutes](https://searoutes.com)
- **Fuel consumption per ship size and speed:** T. Notteboom and P. Cariou, [Fuel surcharge practices of container shipping lines](https://www.researchgate.net/publication/229050596_Fuel_surcharge_practices_of_container_shipping_lines_Is_it_about_cost_recovery_or_revenue-making) (2009)
- **Heavy fuel oil as the main ship fuel:** [Umweltbundesamt](https://www.umweltbundesamt.de/service/uba-fragen/welchem-kraftstoff-fahren-seeschiffe)
- **Energy density of heavy fuel oil and CO₂ per kg burned:** [Deutscher Bundestag, WD 8 - 093/21](https://www.bundestag.de/resource/blob/876928/1c1929bbc1eaa0d85553ff4ed7e4f6eb/WD-8-093-21-pdf.pdf)
- **Engine efficiency:** [Wärtsilä](https://www.wartsila.com/sustainability/climate-and-environment/innovating-for-sustainability/improving-efficiency)
- **Air density:** [International Standard Atmosphere](https://en.wikipedia.org/wiki/International_Standard_Atmosphere)
- **Maps:** [Cesium](https://cesium.com), [CARTO](https://carto.com/attribution), [© OpenStreetMap](https://www.openstreetmap.org/copyright)

## Credits

The wind particles are based on [3D-Wind-Field](https://github.com/RaymanNg/3D-Wind-Field) by RaymanNg (MIT license, see `license.txt`).
