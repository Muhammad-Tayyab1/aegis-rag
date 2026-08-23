module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".spec.ts$",
  testPathIgnorePatterns: ["integration\\.spec\\.ts$"],
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  testEnvironment: "node",
  coverageDirectory: "../coverage",
};
