const Docxtemplater = require('./node_modules/docxtemplater');
const PizZip = require('./node_modules/pizzip');
const fs = require('fs');

try {
  const buf = fs.readFileSync('../1_GIAY_VAN_CHUYEN_TEMPLATE.docx');
  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render({});
  console.log('Rendered OK');
} catch (e) {
  console.log('Error name:', e.name);
  console.log('Error message:', e.message ? e.message.substring(0, 200) : '');
  if (e.properties) {
    console.log('properties.explanation:', e.properties.explanation);
    const errs = e.properties.errors || [];
    console.log('Error count:', errs.length);
    errs.slice(0, 5).forEach((err, i) => {
      console.log('  [' + i + ']', err.properties ? err.properties.explanation : err.message || err.name);
    });
  }
}
