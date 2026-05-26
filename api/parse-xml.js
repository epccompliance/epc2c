module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { accessCode, xmlContent } = body || {};

  const validCode = process.env.DEA_ACCESS_CODE || 'GOGREEN2025';
  if (!accessCode || accessCode.trim() !== validCode) {
    return res.status(401).json({
      error: 'Invalid DEA access code. Contact hello@epc2c.co.uk to register as an authorised DEA partner.'
    });
  }

  if (!xmlContent || typeof xmlContent !== 'string') {
    return res.status(400).json({ error: 'XML content required' });
  }

  function getField(xml, tag) {
    const re = new RegExp('<' + tag + '>([^<]+)</' + tag + '>', 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : null;
  }

  const totalFloorArea = parseFloat(getField(xmlContent, 'Total-Floor-Area')) || 0;
  const wallArea       = parseFloat(getField(xmlContent, 'Wall-Area'))        || 0;
  const roofArea       = parseFloat(getField(xmlContent, 'Roof-Area'))        || 0;
  const windowArea     = parseFloat(getField(xmlContent, 'Window-Area'))      || 0;
  const mainHeating    = getField(xmlContent, 'Main-Heating-Category')        || '';
  const mainFuel       = getField(xmlContent, 'Main-Fuel-Type')               || '';
  const constructionAgeBand  = getField(xmlContent, 'Construction-Age-Band') || '';
  const currentEnergyRating  = getField(xmlContent, 'Current-Energy-Rating') || '';

  // GoGreen Alliance m² rates
  const RATES = {
    cavityWall:    20,   // £/m²
    internalWall:  100,  // £/m²
    externalWall:  150,  // £/m²
    loftInsulation: 10,  // £/m²
    solarPV:       900,  // £/kWp
  };

  const round100 = n => Math.max(0, Math.round(n / 100) * 100);
  function calcCost(base) {
    return { min: round100(base), max: round100(base * 1.2) };
  }

  const pvKwp = roofArea > 0 ? roofArea / 6.5 : 0;

  const costs = {
    cavityWall:     calcCost(wallArea  * RATES.cavityWall),
    internalWall:   calcCost(wallArea  * RATES.internalWall),
    externalWall:   calcCost(wallArea  * RATES.externalWall),
    loftInsulation: calcCost(roofArea  * RATES.loftInsulation),
    solarPV:        calcCost(pvKwp     * RATES.solarPV),
  };

  const dimensions = {
    totalFloorArea, wallArea, roofArea, windowArea,
    mainHeating, mainFuel, constructionAgeBand, currentEnergyRating,
  };

  console.log(`[parse-xml] ok — floor:${totalFloorArea}m² wall:${wallArea}m² roof:${roofArea}m²`);
  res.status(200).json({ success: true, dimensions, costs });
};
