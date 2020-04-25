import fs, { access } from "fs";
import util from "util";
import EnglishDictionary from "en-dictionary";
import GetOpt from "node-getopt";

const Dictionary = EnglishDictionary.default;
const opt = GetOpt.create([
  ["f", "file=FILE", "loads words from a supplied file"],
  ["o", "output=FILE", "outputs to file instead of stdout"],
  ["u", "human", "outputs contents as human-readable JSON"],
  ["r", "raw", "output raw wordnet query to stdout"],
  ["v", "verbose", "echo output stream to stdout (default if no output file)"],
  ["h", "help", "displays this help message"],
])
  .bindHelp()
  .parseSystem();

const { argv, options } = opt;
console.log(argv, options);

if (options.file) handleInputFile(options.file);
else if (argv.length) {
  search(argv)
    .then(buildNetwork)
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
        .then(buildNetwork)
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
  const dictionary = new Dictionary(
    "C:\\Users\\Tobias Fried\\Dropbox\\Personal\\code\\Nodejs\\wordnet-builder\\node_modules\\en-wordnet\\database\\3.1"
  );
  await dictionary.init();

  const result = dictionary.searchFor(words);
  options.raw && log(result);
  return result;
}

function buildNetwork(entryMap) {
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
    const network = Object.keys(entryObject).reduce(
      (acc, word) => {
        const { pos, offsetData = [] } = entryObject[word];

        offsetData.forEach((sense) => {
          const definition = sense.glossary[0];
          acc.responses.push({ source: word, value: definition });
          acc.nodes.push(
            ...[
              ...new Set(
                definition
                  .split(/[ ,()]/)
                  .filter(
                    (value) =>
                      value.length && !value.match(/\d/) && value !== word
                  )
              ),
            ].map((value) => ({ value }))
          );
          acc.edges.push(
            ...[
              ...new Set(
                definition
                  .split(/[ ,()]/)
                  .filter(
                    (target) =>
                      target.length && !target.match(/\d/) && target !== word
                  )
              ),
            ].map((target) => ({ source: word, target }))
          );
        });
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
  console.info(util.inspect(contents, false, null, true));
}
