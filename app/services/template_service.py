from docxtpl import DocxTemplate

def extract_variables(file_path: str):
    doc = DocxTemplate(file_path)
    return doc.get_undeclared_template_variables()

def render_template(template_path: str, context: dict, output_path: str):
    doc = DocxTemplate(template_path)
    doc.render(context)
    doc.save(output_path)
