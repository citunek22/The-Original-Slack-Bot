require("dotenv").config();
const { App } = require("@slack/bolt");
const axios = require("axios");

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

function getWeatherEmoji(code) {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤";
  if (code <= 48) return "🌫";
  if (code <= 67) return "🌧";
  if (code <= 77) return "❄️";
  if (code <= 99) return "⛈";
  return "☁️";
}

app.command("/original-weather", async ({ command, ack, respond }) => {
  await ack();
  const query = command.text.trim();
  if (!query) return await respond("Zadej název místa!");

  try {
    // Globální hledání s vyšším počtem výsledků (count=5) pro lepší úspěšnost
    const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=cs`);
    
    if (!geoRes.data.results || geoRes.data.results.length === 0) {
      return await respond(`Místo "${query}" nebylo nalezeno. Zkus zadat název v angličtině (např. Hurghada).`);
    }
    
    const loc = geoRes.data.results[0];

    // Volání počasí
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index,surface_pressure,visibility,weather_code`;
    const res = await axios.get(url);
    const d = res.data.current;

    const emoji = getWeatherEmoji(d.weather_code);
    
    let outfit = "běžné oblečení";
    if (d.temperature_2m >= 28) outfit = "kraťasy a tričko";
    else if (d.temperature_2m < 10) outfit = "teplá bunda a mikina";
    else if (d.precipitation_probability > 50) outfit = "pláštěnka nebo deštník";

    let spf = d.uv_index >= 6 ? "SPF 30+" : (d.uv_index >= 3 ? "SPF 15" : "není potřeba");

    // Odpověď
    await respond(`${emoji}

*Počasí v ${loc.name}, ${loc.country || ""}:*
🌡 *Teplota:* ${d.temperature_2m}°C (pocitově ${d.apparent_temperature}°C)
💧 *Vlhkost:* ${d.relative_humidity_2m}%
💨 *Vítr:* ${d.wind_speed_10m} m/s
🌬 *Tlak:* ${d.surface_pressure} hPa
👁 *Viditelnost:* ${(d.visibility / 1000).toFixed(1)} km
☀️ *UV Index:* ${d.uv_index}
🧴 *Doporučené SPF:* ${spf}
👕 *Co si vzít:* ${outfit}
🌧 *Šance na déšť:* ${d.precipitation_probability}%`);

  } catch (error) {
    console.error(error);
    await respond("Nastala chyba při získávání dat ze světa.");
  }
});

// --- POMOCNÁ FUNKCE PRO VZDÁLENOST ---
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2)**2;
  return Math.round(R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))));
}

// --- 1. COMMAND: ABOVE ME (50km rádius) ---
app.command("/above-me", async ({ command, ack, respond }) => {
  await ack();
  const query = command.text.trim();
  if (!query) return await respond("Zadej město, např. `/above-me Kladno`.");

  try {
    const geoRes = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
    if (!geoRes.data.results) return await respond("Místo nenalezeno.");
    
    const { latitude: lat, longitude: lon, name } = geoRes.data.results[0];
    const radius = 0.45; // cca 50 km
    const res = await axios.get(`https://opensky-network.org/api/states/all?lamin=${lat-radius}&lamax=${lat+radius}&lomin=${lon-radius}&lomax=${lon+radius}`);
    const planes = res.data.states || [];
    
    if (planes.length === 0) return await respond(`V okruhu 50 km nad ${name} momentálně žádná letadla nejsou.`);
    
    let msg = `✈️ *Letadla v okolí 50 km (${name}):*\n`;
    planes.slice(0, 10).forEach(p => {
      const call = p[1]?.trim() || "Neznámé";
      const model = p[8] || "N/A";
      const alt = p[7] ? Math.round(p[7]) + "m" : "N/A";
      msg += `• *${call}* (${model}) | Výška: ${alt} | <https://www.flightradar24.com/${call}|FR24>\n`;
    });
    await respond(msg);
  } catch (e) { await respond("Chyba při komunikaci s radarem."); }
});

// --- COMMAND: CURRENCY (Převod měn) ---
app.command("/currency", async ({ command, ack, respond }) => {
  await ack();
  
  // Rozdělíme vstup (např. "100 USD CZK")
  const args = command.text.trim().split(" ");
  if (args.length < 3) {
    return await respond("Použití: `/currency [částka] [odkud] [kam]` (např. `/currency 100 USD CZK`).");
  }

  const amount = parseFloat(args[0]);
  const from = args[1].toUpperCase();
  const to = args[2].toUpperCase();

  try {
    // API, které nepotřebuje klíč (v základní verzi zdarma)
    const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`);
    const rate = res.data.rates[to];

    if (!rate) {
      return await respond(`Nepodařilo se najít měnový kurz pro ${from} -> ${to}.`);
    }

    const result = (amount * rate).toFixed(2);
    await respond(`💱 *Převod měn:*
    • ${amount} ${from} = *${result} ${to}*
    • _Kurz: 1 ${from} = ${rate} ${to}_`);

  } catch (e) {
    await respond("Nastala chyba při získávání kurzu měn.");
  }
});

app.command("/original-bot-help", async ({ ack, respond }) => {
  await ack();
  await respond(`✈️ *Travel Assistant - Command Overview:*

  • \`/theoriginalslack...\` - Pings the server to check if the bot is online.
  • \`/original-weather [city]\` - Shows the current weather in the selected city.
  • \`/above-me [city]\` - Shows planes within a 50 km radius of the location.
  • \`/currency [amount] [from] [to]\` - Converts currency using current exchange rates (e.g., /currency 100 USD CZK).

  *Note: Do not type the brackets [ ] in your command, they are just placeholders.*`);
});

(async () => {
  await app.start();
  console.log("Bot běží!");
})();