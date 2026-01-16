/**
 * System Prompts for Chatbot
 * 
 * Reads and parses the YAML file from apps/docs/prompts/general_personality.yaml
 * and converts it to a system prompt string for the LLM.
 * 
 * The YAML content is imported from general_personality.yaml.ts which contains
 * the YAML file content as a string constant.
 */

import * as yaml from 'js-yaml';
import { generalPersonalityYaml } from '../prompts/general_personality';

/**
 * Convert YAML structure to a system prompt string
 */
function yamlToSystemPrompt(yamlContent: string): string {
  try {
    if (!yamlContent || typeof yamlContent !== 'string') {
      throw new Error('YAML content is not a valid string');
    }

    const parsed = yaml.load(yamlContent) as any;
    
    if (!parsed) {
      throw new Error('YAML parsing returned null or undefined');
    }

    console.log('Parsed YAML keys:', Object.keys(parsed));
    
    if (!parsed?.agent_personality) {
      console.error('Parsed YAML structure:', JSON.stringify(parsed, null, 2));
      throw new Error('Invalid YAML structure: missing agent_personality');
    }

    const personality = parsed.agent_personality;
    const parts: string[] = [];

    // Name and purpose
    parts.push(`You are ${personality.name || 'a General Agent Helper Agent'}.`);
    if (personality.purpose) {
      parts.push(`\nYour purpose is to ${personality.purpose.trim()}`);
    }

    // Tone
    if (personality.tone && Array.isArray(personality.tone)) {
      parts.push('\n\nTONE:');
      personality.tone.forEach((t: string) => parts.push(`- ${t}`));
    }

    // Language style
    if (personality.language_style) {
      parts.push('\n\nLANGUAGE STYLE:');
      const style = personality.language_style;
      
      if (style.sentences) {
        const maxLength = style.sentences.max_length?.replace('_', ' ') || '20 words';
        parts.push(`- Sentences: ${style.sentences.preference} (max ${maxLength})`);
      }
      
      if (style.paragraphs) {
        parts.push(`- Paragraphs: ${style.paragraphs.preference} - ${style.paragraphs.rule}`);
      }
      
      if (style.vocabulary?.action_terms) {
        parts.push(`- Vocabulary: Always reuse approved action terms verbatim:`);
        style.vocabulary.action_terms.forEach((term: string) => {
          parts.push(`  * "${term}"`);
        });
      }
    }

    // Guardrails
    if (personality.guardrails) {
      parts.push('\n\nGUARDRAILS:');
      const guards = personality.guardrails;
      
      if (guards.personal_data?.rule) {
        parts.push(`- Personal data: ${guards.personal_data.rule}`);
      }
      if (guards.certainty?.rule) {
        parts.push(`- Certainty: ${guards.certainty.rule}`);
      }
      if (guards.uncertainty_handling?.rule) {
        parts.push(`- Uncertainty handling: ${guards.uncertainty_handling.rule}`);
      }
      if (guards.honesty?.rule) {
        parts.push(`- Honesty: ${guards.honesty.rule}`);
      }
    }

    // Response structure
    if (personality.response_structure) {
      parts.push('\n\nRESPONSE STRUCTURE:');
      const structure = personality.response_structure;
      
      if (structure.default) {
        parts.push(`- Default: ${structure.default.join(', ')}`);
      }
      if (structure.when_explaining) {
        parts.push(`- When explaining: ${structure.when_explaining.join(', ')}`);
      }
      if (structure.when_blocked) {
        parts.push(`- When blocked: ${structure.when_blocked.join(', ')}`);
      }
    }

    // Do list
    if (personality.do_list && Array.isArray(personality.do_list)) {
      parts.push('\n\nDO:');
      personality.do_list.forEach((item: string) => parts.push(`- ${item}`));
    }

    // Don't list
    if (personality.dont_list && Array.isArray(personality.dont_list)) {
      parts.push('\n\nDON\'T:');
      personality.dont_list.forEach((item: string) => parts.push(`- ${item}`));
    }

    // Example responses
    if (personality.example_responses) {
      parts.push('\n\nEXAMPLE RESPONSES:');
      const examples = personality.example_responses;
      
      Object.keys(examples).forEach((key) => {
        const example = examples[key];
        if (example.description && example.response) {
          parts.push(`\n${example.description}:`);
          parts.push(`"${example.response.trim()}"`);
        }
      });
    }

    // Enforcement note
    if (personality.enforcement_note) {
      parts.push('\n\nENFORCEMENT NOTE:');
      parts.push(personality.enforcement_note);
    }

    return parts.join('\n');
  } catch (error) {
    console.error('Error parsing YAML:', error);
    throw error;
  }
}

// Parse the YAML content and create the system prompt
// Wrap in try-catch to provide a fallback if parsing fails
let GENERAL_PERSONALITY_SYSTEM_PROMPT: string;

try {
  if (!generalPersonalityYaml) {
    throw new Error('generalPersonalityYaml is not defined');
  }
  GENERAL_PERSONALITY_SYSTEM_PROMPT = yamlToSystemPrompt(generalPersonalityYaml);
} catch (error) {
  console.error('Failed to parse YAML, using fallback prompt:', error);
  // Fallback prompt if YAML parsing fails
  GENERAL_PERSONALITY_SYSTEM_PROMPT = 'You are a helpful assistant for a marketplace app. Answer clearly and concisely.';
}

export { GENERAL_PERSONALITY_SYSTEM_PROMPT };
