import swaggerJSDoc from 'swagger-jsdoc';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'FlowPDF API',
      version: '1.0.0',
      description:
        'DOCX Template → PDF rendering microservice. Upload a .docx template with {placeholder} variables, inject JSON data, and get a crisp PDF back in milliseconds. Also supports combining multiple file types into a single PDF.',
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key set via FLOWPDF_API_KEY environment variable',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './dist/routes/*.js'],
};

export const swaggerSpec = swaggerJSDoc(options);
