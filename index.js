const { XorShift1024Star } = require("xorshift.js");
const byteSize = require("byte-size");
const _hrtime = require("browser-process-hrtime");

const nodeCrypto = require("create-hash/index");
const jsCrypto = require("create-hash/browser");

const SEED = "176D4F8638E08ACDE420A7FE72EC8A5A9E90E31034ABA768F927B0A5D6F4AA08";
const prng = new XorShift1024Star(SEED, 0);

const gendata = (size, len) => ({
  size,
  buffers: new Array(len).fill(null).map(() => prng.randomBytes(size)),
});

const data = [
  gendata(10 ** 2, 100),
  // gendata(10 ** 2, 10000),
  // gendata(10 ** 3, 1000),
  // gendata(10 ** 4, 100),
  // gendata(10 ** 5, 100),
  // gendata(10 ** 6, 10),
];

const modules = [
  {
    name: "jsCrypto",
    functions: {
      // rmd160: (v) => jsCrypto("rmd160").update(v).digest(),
      sha1: (v) => jsCrypto("sha1").update(v).digest(),
      sha256: (v) => jsCrypto("sha256").update(v).digest(),
    },
  },
];

if (process.browser) {
  modules.push({
    name: "webCrypto",
    functions: {
      sha1: (v) => crypto.subtle.digest("SHA-1", v),
      sha256: (v) => crypto.subtle.digest("SHA-256", v),
    },
  });
} else {
  modules.push({
    name: "nodeCrypto",
    functions: {
      // rmd160: (v) => nodeCrypto("rmd160").update(v).digest(),
      sha1: (v) => nodeCrypto("sha1").update(v).digest(),
      sha256: (v) => nodeCrypto("sha256").update(v).digest(),
    },
  });
}

function hrtime(start) {
  if (start === undefined) {
    return _hrtime();
  }

  const elapsed = _hrtime(start);
  return elapsed[0] * 1e3 + elapsed[1] / 1e6;
}

// Warmup bench function during
async function warmingUp(bench, maxTime) {
  const start = hrtime();
  while (hrtime(start) < maxTime) {
    await bench();
  }
}

// Create benchmark function from fixtures
function createBenchmarkFn(fn, fixtures) {
  return async function () {
    for (const fixture of fixtures) {
      let result = fn(fixture);
      if (result.then) await result;
    }
    return fixtures.length;
  };
}

// Run benchmarks
async function main() {
  const warmingUpMaxTime = 15;
  const benchmarkMaxTime = 50;

  const lineEqual = new Array(100).fill("=").join("");
  const lineDash = new Array(100).fill("-").join("");

  let isFirstResult = true;
  for (const name of Object.keys(modules[0].functions)) {
    for (const { size, buffers } of data) {
      if (isFirstResult) {
        console.log(lineEqual);
        isFirstResult = false;
      }
      console.log(`Benchmarking function: ${name} (size: ${byteSize(size)})`);
      console.log(lineDash);
      const results = [];
      for (const module of modules) {
        const bench = createBenchmarkFn(module.functions[name], buffers);

        await warmingUp(bench, warmingUpMaxTime);

        const results_ns = [];
        const start = hrtime();
        let start_fn = start;
        for (let i = 0; ; ) {
          const ops = await bench();
          results_ns.push((hrtime(start_fn) * 1e6) / ops);
          if (hrtime(start) > benchmarkMaxTime && ++i >= 2) {
            break;
          }
          start_fn = hrtime();
        }

        const ops_avg_ns =
          results_ns.reduce((total, time) => total + time, 0) /
          results_ns.length;
        const ops_err_ns =
          results_ns.length > 1
            ? results_ns.reduce(
                (total, time) => total + Math.abs(ops_avg_ns - time),
                0
              ) /
              (results_ns.length - 1)
            : 0;
        const ops_err = (ops_err_ns / ops_avg_ns) * 100;

        console.log(
          `${module.name}: ${(ops_avg_ns / 1000).toFixed(2)} us/op (${(
            10 ** 9 /
            ops_avg_ns
          ).toFixed(2)} op/s), ±${ops_err.toFixed(2)} %`
        );

        results.push({ name: module.name, ops_avg_ns });
      }
      if (results.length > 1) {
        const fastest = results.reduce((a, b) =>
          a.ops_avg_ns < b.ops_avg_ns ? a : b
        );
        console.log(lineDash);
        console.log(`Fastest: ${fastest.name}`);
      }
      console.log(lineEqual);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => {
    if (process.browser) {
      window.close();
    }
  });
