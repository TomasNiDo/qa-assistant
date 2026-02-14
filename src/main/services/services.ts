import type Database from 'better-sqlite3';
import { AIService } from './aiService';
import { ConfigService } from './configService';
import { parseStep } from './parserService';
import { ProjectService } from './projectService';
import { RunService } from './runService';
import { SampleSeedService } from './sampleSeedService';
import { TestCaseService } from './testCaseService';

export interface Services {
  projectService: ProjectService;
  testCaseService: TestCaseService;
  runService: RunService;
  aiService: AIService;
  configService: ConfigService;
  sampleSeedService: SampleSeedService;
  parserService: {
    parse: typeof parseStep;
  };
}

export function createServices(
  db: Database.Database,
  artifactsDir: string,
  configFile: string,
): Services {
  const projectService = new ProjectService(db);
  const testCaseService = new TestCaseService(db);

  return {
    projectService,
    testCaseService,
    runService: new RunService(db, artifactsDir),
    aiService: new AIService(db, process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL),
    configService: new ConfigService(configFile),
    sampleSeedService: new SampleSeedService(projectService, testCaseService),
    parserService: {
      parse: parseStep,
    },
  };
}
