const fs = require('fs-extra');
const path = require('path');
const ProjectDetector = require('../src/detectors/project-detector');

describe('ProjectDetector', () => {
  let testDir;
  let detector;

  beforeEach(async () => {
    testDir = path.join(__dirname, 'fixtures', 'test-project');
    await fs.ensureDir(testDir);
    detector = new ProjectDetector(testDir);
  });

  afterEach(async () => {
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
  });

  describe('detectAngular', () => {
    test('should detect Angular project with package.json', async () => {
      const packageJson = {
        dependencies: {
          '@angular/core': '^15.0.0'
        }
      };
      await fs.writeJson(path.join(testDir, 'package.json'), packageJson);

      const result = await detector.detectAngular();
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('medium');
      expect(result.indicators.packageJson).toBe(true);
    });

    test('should detect Angular project with angular.json', async () => {
      const packageJson = {
        dependencies: {
          '@angular/core': '^15.0.0'
        }
      };
      const angularJson = {
        version: 1,
        projects: {}
      };
      
      await fs.writeJson(path.join(testDir, 'package.json'), packageJson);
      await fs.writeJson(path.join(testDir, 'angular.json'), angularJson);

      const result = await detector.detectAngular();
      
      expect(result.detected).toBe(true);
      expect(result.confidence).toBe('high');
      expect(result.indicators.angularJson).toBe(true);
    });

    test('should not detect Angular in non-Angular project', async () => {
      const packageJson = {
        dependencies: {
          'react': '^18.0.0'
        }
      };
      await fs.writeJson(path.join(testDir, 'package.json'), packageJson);

      const result = await detector.detectAngular();
      
      expect(result.detected).toBe(false);
    });
  });

  describe('detectSpringBoot', () => {
    test('should detect Spring Boot with pom.xml', async () => {
      const pomXml = `
        <project>
          <dependencies>
            <dependency>
              <groupId>org.springframework.boot</groupId>
              <artifactId>spring-boot-starter</artifactId>
            </dependency>
          </dependencies>
        </project>
      `;
      await fs.writeFile(path.join(testDir, 'pom.xml'), pomXml);

      const result = await detector.detectSpringBoot();
      
      expect(result.detected).toBe(true);
      expect(result.buildTool).toBe('maven');
      expect(result.indicators.pomXml).toBe(true);
    });

    test('should detect Spring Boot with build.gradle', async () => {
      const buildGradle = `
        plugins {
          id 'org.springframework.boot' version '2.7.0'
        }
        dependencies {
          implementation 'org.springframework.boot:spring-boot-starter'
        }
      `;
      await fs.writeFile(path.join(testDir, 'build.gradle'), buildGradle);

      const result = await detector.detectSpringBoot();
      
      expect(result.detected).toBe(true);
      expect(result.buildTool).toBe('gradle');
      expect(result.indicators.buildGradle).toBe(true);
    });
  });

  describe('detectAll', () => {
    test('should detect multiple project types', async () => {
      // Create a project with both Node.js and Angular
      const packageJson = {
        dependencies: {
          '@angular/core': '^15.0.0',
          'react': '^18.0.0'
        }
      };
      await fs.writeJson(path.join(testDir, 'package.json'), packageJson);

      const result = await detector.detectAll();
      
      expect(Object.keys(result.detected)).toContain('angular');
      expect(Object.keys(result.detected)).toContain('react');
      expect(Object.keys(result.detected)).toContain('nodejs');
      expect(result.primary).toBeDefined();
    });

    test('should return empty detected for unknown project', async () => {
      // Empty directory
      const result = await detector.detectAll();
      
      expect(Object.keys(result.detected)).toHaveLength(0);
      expect(result.primary).toBe('unknown');
    });
  });
});
