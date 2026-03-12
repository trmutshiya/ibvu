// ── Colour palette for herb cards ─────────────────────────────────────────
export const COLOUR_PALETTE = [
  "#a8c5a0","#c4b49a","#9ab5c5","#c5c4a0","#a0c5c4","#c4a0b4",
  "#b5c4a0","#c5b4a0","#a8b4c5","#c4a8a0","#a0c5b4","#b4c4a8",
];

// ── Country → Region map ──────────────────────────────────────────────────
export const COUNTRY_REGION = {
  "Zimbabwe":"Southern Africa","South Africa":"Southern Africa","Zambia":"Southern Africa",
  "Mozambique":"Southern Africa","Botswana":"Southern Africa","Namibia":"Southern Africa",
  "Lesotho":"Southern Africa","Eswatini":"Southern Africa","Malawi":"Southern Africa",
  "Kenya":"East Africa","Tanzania":"East Africa","Uganda":"East Africa","Ethiopia":"East Africa",
  "Rwanda":"East Africa","Burundi":"East Africa","Somalia":"East Africa","Eritrea":"East Africa",
  "Nigeria":"West Africa","Ghana":"West Africa","Senegal":"West Africa","Ivory Coast":"West Africa",
  "Mali":"West Africa","Burkina Faso":"West Africa","Guinea":"West Africa","Sierra Leone":"West Africa",
  "Cameroon":"Central Africa","DR Congo":"Central Africa","Congo":"Central Africa","Gabon":"Central Africa",
  "Egypt":"North Africa","Morocco":"North Africa","Tunisia":"North Africa","Algeria":"North Africa",
  "Libya":"North Africa","Sudan":"North Africa",
  "Greece":"Mediterranean","Italy":"Mediterranean","Spain":"Mediterranean","Portugal":"Mediterranean",
  "Turkey":"Mediterranean","Lebanon":"Mediterranean","Syria":"Mediterranean","Israel":"Mediterranean",
  "Jordan":"Mediterranean","Cyprus":"Mediterranean","Malta":"Mediterranean",
  "Afghanistan":"Central Asia","Kazakhstan":"Central Asia","Uzbekistan":"Central Asia",
  "Turkmenistan":"Central Asia","Tajikistan":"Central Asia","Kyrgyzstan":"Central Asia",
  "Iran":"Central Asia","Iraq":"Middle East","Saudi Arabia":"Middle East","UAE":"Middle East",
  "Qatar":"Middle East","Kuwait":"Middle East","Oman":"Middle East","Yemen":"Middle East",
  "India":"South Asia","Sri Lanka":"South Asia","Nepal":"South Asia","Bangladesh":"South Asia",
  "Pakistan":"South Asia","Bhutan":"South Asia","Maldives":"South Asia",
  "China":"East Asia","Japan":"East Asia","South Korea":"East Asia","North Korea":"East Asia",
  "Mongolia":"East Asia","Taiwan":"East Asia",
  "Thailand":"Southeast Asia","Vietnam":"Southeast Asia","Indonesia":"Southeast Asia",
  "Malaysia":"Southeast Asia","Philippines":"Southeast Asia","Myanmar":"Southeast Asia",
  "Cambodia":"Southeast Asia","Laos":"Southeast Asia","Singapore":"Southeast Asia",
  "USA":"North America","United States":"North America","Canada":"North America",
  "Mexico":"Central America","Guatemala":"Central America","Honduras":"Central America",
  "Costa Rica":"Central America","Panama":"Central America",
  "Brazil":"South America","Peru":"South America","Colombia":"South America",
  "Chile":"South America","Argentina":"South America","Bolivia":"South America",
  "Ecuador":"South America","Venezuela":"South America","Paraguay":"South America",
  "UK":"Europe","United Kingdom":"Europe","France":"Europe","Germany":"Europe",
  "Russia":"Europe","Poland":"Europe","Netherlands":"Europe","Sweden":"Europe",
  "Norway":"Europe","Finland":"Europe","Switzerland":"Europe","Austria":"Europe",
  "Australia":"Oceania","New Zealand":"Oceania","Papua New Guinea":"Oceania",
};

export function normaliseOrigin(country) {
  if (!country) return "";
  const trimmed = country.trim();
  return COUNTRY_REGION[trimmed] || trimmed;
}
