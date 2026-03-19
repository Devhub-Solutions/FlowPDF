const Docxtemplater = require('./node_modules/docxtemplater');
const PizZip = require('./node_modules/pizzip');
const fs = require('fs');

try {
  const buf = fs.readFileSync('../1_GIAY_VAN_CHUYEN_TEMPLATE.docx');
  const zip = new PizZip(buf);
  console.log('Creating Docxtemplater...');
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  console.log('Docxtemplater created OK');
  
  try {
    console.log('Calling render...');
    doc.render({});
    console.log('Rendered OK');
  } catch (e) {
    console.log('render() error name:', e.name);
    console.log('render() error message:', e.message ? e.message.substring(0, 200) : 'no message');
  }
} catch (e) {
  console.log('Constructor error name:', e.name);
  console.log('Constructor error message:', e.message ? e.message.substring(0, 200) : 'no message');
}
