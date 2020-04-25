import fs from "fs";
import util from "util";
import EnglishDictionary from "en-dictionary";
import GetOpt from "node-getopt";

const Dictionary = EnglishDictionary.default;
const help = `\
Usage:
  node wordnet-builder [OPTION]... [WORD]...

Options:
[[OPTIONS]]\
`;

const opt = GetOpt.create([
  ["f", "file=FILE", "loads words from a supplied file"],
  ["o", "output=FILE", "outputs to file instead of stdout"],
  ["u", "human", "outputs contents as human-readable JSON"],
  ["c", "color", "colored ouput (incompatible with redirection)"],
  ["r", "raw", "output raw wordnet query to stdout"],
  ["v", "verbose", "echo output stream to stdout (default if no output file)"],
  ["h", "help", "displays this help message"],
])
  .bindHelp(help)
  .parseSystem();

const { argv, options } = opt;
options.verbose && console.log(argv, options);

if (options.file) handleInputFile(options.file);
else if (argv.length) {
  search(argv)
    .then(parse)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
} else console.error("No input provided");

async function handleInputFile(path) {
  if (fs.existsSync(path)) {
    try {
      const words = fs.readFileSync(path).toString().split("\n");
      search(words)
        .then(parse)
        .catch((error) => {
          console.error(error);
          process.exitCode = 1;
        });
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    }
  } else {
    console.error(`File '${options.file}' not found`);
    process.exitCode = 1;
  }
}

async function search(words) {
  // TODO: figure out what's wrong with en-wordnet path
  const dictionary = new Dictionary(
    "C:\\Users\\Tobias Fried\\Dropbox\\Personal\\code\\Nodejs\\wordnet-builder\\node_modules\\en-wordnet\\database\\3.1"
  );
  await dictionary.init();
  const result = dictionary.searchFor(words);

  if (options.raw) console.info(util.inspect(result, { depth: null, colors: true }));
  else return result;
}

function parse(entryMap) {
  let entryObject = {};
  for (let [key, value] of entryMap) {
    entryObject[key] = value;
  }
  if (options.human) {
    const readable = Object.keys(entryObject).reduce((acc, word) => {
      const { pos, offsetData } = entryObject[word];
      acc[word] = {
        pos,
        senses: offsetData.map((sense) => ({
          words: sense.words.join(", "),
          pos: sense.pos,
          definition: sense.glossary[0],
        })),
      };
      return acc;
    }, {});
    output(readable);
  } else {
    const tokenSeparators = /[ ,()]/;
    const network = Object.keys(entryObject).reduce(
      (acc, word) => {
        const { offsetData = [] } = entryObject[word];
        const isValidToken = (token) =>
          token.length && !token.match(/\d/) && token !== word;

        for (let sense of offsetData) {
          const definition = sense.glossary[0];
          acc.responses.push({ source: word, value: definition });
          acc.nodes.push(
            ...[
              ...new Set(
                definition.split(tokenSeparators).filter(isValidToken)
              ),
            ].map((value) => ({ value }))
          );
          acc.edges.push(
            ...[
              ...new Set(
                definition.split(tokenSeparators).filter(isValidToken)
              ),
            ].map((target) => ({ source: word, target }))
          );
        }
        return acc;
      },
      { responses: [], nodes: [], edges: [] }
    );
    output(network);
  }
}

function output(network) {
  if (options.output) {
    try {
      fs.writeFileSync(options.output, JSON.stringify(network, null, 2));
      options.verbose && !options.raw && log(network);
    } catch (e) {
      console.error(e);
      process.exitCode = 1;
    }
  } else {
    !options.raw && log(network);
  }
}

function log(contents) {
  if (options.color) {
    console.info(util.inspect(contents, { depth: null, colors: true }));
  } else {
    console.log(JSON.stringify(contents, null, 2));
  }
}
