const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "5 Jan, 12:00" (UTC) for a start ISO string plus seconds
export function formatDate(startIso, seconds = 0, withTime = true) {
  const d = new Date(Date.parse(startIso) + seconds * 1000);
  const date = d.getUTCDate() + " " + months[d.getUTCMonth()];
  if (!withTime) return date;
  return date + ", " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
}

export function formatDuration(seconds) {
  // round to whole hours first, otherwise 3 d 23.9 h becomes "3 d 24 h"
  const totalHours = Math.round(seconds / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? days + " d " + hours + " h" : hours + " h";
}

// kg -> "1.24 t" or "830 kg"
export function formatMass(kg) {
  if (Math.abs(kg) >= 1000) return (kg / 1000).toLocaleString("en", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " t";
  return Math.round(kg).toLocaleString("en") + " kg";
}

export function formatNumber(value, digits = 0) {
  return value.toLocaleString("en", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

// newtons -> "412 kN"
export function formatForce(newtons) {
  return formatNumber(newtons / 1000, 0) + " kN";
}
