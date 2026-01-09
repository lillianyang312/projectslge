import fs from "fs";
import path from "path";

/**
 * Reads a YAML file and returns its contents as a string.
 * Intended for passing agent personality specs directly into prompt inputs.
 *
 * @param yamlFilePath - Relative or absolute path to the YAML file
 * @returns YAML file contents as a string
 */
export function yamlToPromptString(yamlFilePath: string): string {
  const resolvedPath = path.resolve(yamlFilePath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`YAML file not found: ${resolvedPath}`);
  }

  const fileContents = fs.readFileSync(resolvedPath, "utf-8");

  if (!fileContents.trim()) {
    throw new Error(`YAML file is empty: ${resolvedPath}`);
  }

  return fileContents;
}

// Example usage:
if (require.main === module) {
  const agentPersonalityPrompt = yamlToPromptString(
    "./prompts/general_personality.yaml"
  );
  console.log(agentPersonalityPrompt);
}