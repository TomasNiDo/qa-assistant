import type Database from 'better-sqlite3';
import { AIService } from './aiService';
import { ConfigService } from './configService';
import { parseStep } from './parserService';
import { ProjectService } from './projectService';
import { RunService } from './runService';
import { TestCaseService } from './testCaseService';

export interface Services {
  projectService: ProjectService;
  testCaseService: TestCaseService;
  runService: RunService;
  aiService: AIService;
  configService: ConfigService;
  parserService: {
    parse: typeof parseStep;
  };
}

export function createServices(
  db: Database.Database,
  artifactsDir: string,
  configFile: string,
): Services {
  return {
    projectService: new ProjectService(db),
    testCaseService: new TestCaseService(db),
    runService: new RunService(db, artifactsDir),
    aiService: new AIService(db, process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL),
    configService: new ConfigService(configFile),
    parserService: {
      parse: parseStep,
    },
  };
}
