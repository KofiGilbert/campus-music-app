const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole monorepo so Metro can resolve shared libs
config.watchFolders = [workspaceRoot];

// Resolve modules from both local and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Follow symlinks so pnpm store assets resolve correctly
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
