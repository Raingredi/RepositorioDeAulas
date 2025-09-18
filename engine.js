// engine.js
const { Marpit } = require('@marp-team/marpit');

// Plugins markdown-it
const markdownItAttrs = require('markdown-it-attrs');
const markdownItContainer = require('markdown-it-container');
const markdownItDeflist = require('markdown-it-deflist');
const markdownItFootnote = require('markdown-it-footnote');
const markdownItMathjax = require('markdown-it-mathjax3').default;
const markdownItMermaid = require('markdown-it-mermaid').default;

module.exports = (opts = {}) => {
  const marpit = new Marpit(opts);

  // Ativar HTML inline para suportar elementos customizados
  marpit.options.html = true;

  // Configurar markdown-it com todos os plugins
  marpit.markdown
    .use(markdownItAttrs)                    // atributos customizados {style="..."}
    .use(markdownItDeflist)                  // listas de definição
    .use(markdownItFootnote)                 // notas de rodapé
    .use(markdownItMathjax)                  // LaTeX / KaTeX - fórmulas matemáticas
    .use(markdownItMermaid)                  // Diagramas Mermaid
    .use(markdownItContainer, 'fragment', {
      render: (tokens, idx) => {
        const token = tokens[idx];
        if (token.nesting === 1) {
          return '<div class="fragment">\n';
        } else {
          return '</div>\n';
        }
      },
    });

  return marpit;
};
