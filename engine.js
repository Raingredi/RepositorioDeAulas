// engine.js
const { Marpit } = require('@marp-team/marpit');

// Plugins markdown-it
const markdownItMermaid = require('markdown-it-mermaid').default; // Diagramas Mermaid
const markdownItMathjax = require('markdown-it-mathjax3');        // LaTeX / KaTeX
const markdownItAttrs = require('markdown-it-attrs');             // Atributos customizados
const markdownItContainer = require('markdown-it-container');     // Suporte a blocos customizados
const markdownItDeflist = require('markdown-it-deflist');         // Listas melhoradas
const markdownItFootnote = require('markdown-it-footnote');       // Notas de rodapé (citações)

module.exports = (opts = {}) => {
  const marpit = new Marpit(opts);

  // Ativar HTML inline para suportar:
  // - FontAwesome (<i class="fa ...">)
  // - CSS inline / scoped (<style>)
  // - Diagramas SVG inline (<svg>)
  // - Arte ASCII em blocos <pre>
  marpit.options.html = true;

  // Configurar markdown-it
  marpit.markdown
    .use(markdownItMermaid)   // <MermaidDiagramas>
    .use(markdownItMathjax()) // <MatematicaLatex>
    .use(markdownItAttrs)     // atributos inline {style="..."}
    .use(markdownItDeflist)   // listas de definição
    .use(markdownItFootnote)  // notas de rodapé para <CitacoesEMaterialComplementar>
    .use(markdownItContainer, 'fragment', {
      render: (tokens, idx) => {
        // Para <ListasFragmentadas> — cada item pode ser revelado aos poucos
        const token = tokens[idx];
        if (token.nesting === 1) {
          return '<div class="fragment">\n';
        } else {
          return '</div>\n';
        }
      },
    });

  // 🔧 Recursos sem plugin dedicado:
  // - <DelimitacaoDeSlides>: já suportado pelo separador `---` padrão do Marp.
  // - <ImagensEFundos>: suportado nativamente pelo Marp via ![bg] e atributos.
  // - <IconesFontAwesome>: basta importar CSS do FA no frontmatter/style global.
  // - <CSSInlineEScoped>: permitido com marpit.options.html = true.
  // - <DiagramasSVGInline>: também suportado via HTML inline (<svg>…</svg>).
  // - <DiagramasASCII>: tratado como blocos de código ou <pre>.

  return marpit;
};
