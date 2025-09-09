const fs = require('fs-extra');
const path = require('path');

/**
 * Phát hiện loại dự án dựa trên các file cấu hình
 */
class ProjectDetector {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Phát hiện tất cả loại dự án có thể
   * @returns {Object} Object chứa thông tin các loại dự án được phát hiện
   */
  async detectAll() {
    const results = {
      angular: await this.detectAngular(),
      springBoot: await this.detectSpringBoot(),
      react: await this.detectReact(),
      vue: await this.detectVue(),
      nodejs: await this.detectNodeJS(),
      java: await this.detectJava(),
      python: await this.detectPython(),
      dotnet: await this.detectDotNet()
    };

    // Lọc ra các loại dự án được phát hiện
    const detected = Object.entries(results)
      .filter(([_, info]) => info.detected)
      .reduce((acc, [type, info]) => {
        acc[type] = info;
        return acc;
      }, {});

    return {
      detected,
      primary: this.determinePrimaryType(detected),
      all: results
    };
  }

  /**
   * Phát hiện Angular project
   */
  async detectAngular() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const angularJsonPath = path.join(this.projectPath, 'angular.json');
      
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        const hasAngularCore = deps['@angular/core'];
        const hasAngularCli = deps['@angular/cli'];
        const hasAngularJson = await fs.pathExists(angularJsonPath);
        
        if (hasAngularCore || hasAngularCli || hasAngularJson) {
          return {
            detected: true,
            confidence: hasAngularCore && hasAngularJson ? 'high' : 'medium',
            version: hasAngularCore || 'unknown',
            indicators: {
              packageJson: !!hasAngularCore || !!hasAngularCli,
              angularJson: hasAngularJson,
              dependencies: Object.keys(deps).filter(dep => dep.startsWith('@angular/'))
            }
          };
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Phát hiện Spring Boot project
   */
  async detectSpringBoot() {
    try {
      const pomPath = path.join(this.projectPath, 'pom.xml');
      const gradlePath = path.join(this.projectPath, 'build.gradle');
      const gradleKtsPath = path.join(this.projectPath, 'build.gradle.kts');
      
      // Kiểm tra Maven (pom.xml)
      if (await fs.pathExists(pomPath)) {
        const pomContent = await fs.readFile(pomPath, 'utf8');
        if (pomContent.includes('spring-boot-starter') || pomContent.includes('org.springframework.boot')) {
          return {
            detected: true,
            confidence: 'high',
            buildTool: 'maven',
            indicators: {
              pomXml: true,
              springBootStarter: pomContent.includes('spring-boot-starter')
            }
          };
        }
      }
      
      // Kiểm tra Gradle
      for (const gradleFile of [gradlePath, gradleKtsPath]) {
        if (await fs.pathExists(gradleFile)) {
          const gradleContent = await fs.readFile(gradleFile, 'utf8');
          if (gradleContent.includes('spring-boot') || gradleContent.includes('org.springframework.boot')) {
            return {
              detected: true,
              confidence: 'high',
              buildTool: gradleFile.endsWith('.kts') ? 'gradle-kotlin' : 'gradle',
              indicators: {
                buildGradle: true,
                springBootPlugin: gradleContent.includes('org.springframework.boot')
              }
            };
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Phát hiện React project
   */
  async detectReact() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) {
          return {
            detected: true,
            confidence: 'high',
            version: deps.react,
            indicators: {
              react: true,
              reactDom: !!deps['react-dom'],
              nextJs: !!deps.next,
              createReactApp: !!deps['react-scripts']
            }
          };
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Phát hiện Vue project
   */
  async detectVue() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.vue) {
          return {
            detected: true,
            confidence: 'high',
            version: deps.vue,
            indicators: {
              vue: true,
              vueRouter: !!deps['vue-router'],
              vuex: !!deps.vuex,
              nuxt: !!deps.nuxt
            }
          };
        }
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Phát hiện Node.js project
   */
  async detectNodeJS() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      return {
        detected: await fs.pathExists(packageJsonPath),
        confidence: 'high',
        indicators: {
          packageJson: await fs.pathExists(packageJsonPath)
        }
      };
    } catch (error) {
      return { detected: false };
    }
  }

  /**
   * Phát hiện Java project
   */
  async detectJava() {
    try {
      const pomPath = path.join(this.projectPath, 'pom.xml');
      const gradlePath = path.join(this.projectPath, 'build.gradle');
      const gradleKtsPath = path.join(this.projectPath, 'build.gradle.kts');
      
      const hasPom = await fs.pathExists(pomPath);
      const hasGradle = await fs.pathExists(gradlePath) || await fs.pathExists(gradleKtsPath);
      
      if (hasPom || hasGradle) {
        return {
          detected: true,
          confidence: 'high',
          buildTool: hasPom ? 'maven' : 'gradle',
          indicators: {
            maven: hasPom,
            gradle: hasGradle
          }
        };
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Phát hiện Python project
   */
  async detectPython() {
    try {
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      const pipfilePath = path.join(this.projectPath, 'Pipfile');
      const pyprojectPath = path.join(this.projectPath, 'pyproject.toml');
      const setupPyPath = path.join(this.projectPath, 'setup.py');
      
      const hasRequirements = await fs.pathExists(requirementsPath);
      const hasPipfile = await fs.pathExists(pipfilePath);
      const hasPyproject = await fs.pathExists(pyprojectPath);
      const hasSetupPy = await fs.pathExists(setupPyPath);
      
      if (hasRequirements || hasPipfile || hasPyproject || hasSetupPy) {
        return {
          detected: true,
          confidence: 'high',
          indicators: {
            requirements: hasRequirements,
            pipfile: hasPipfile,
            pyproject: hasPyproject,
            setupPy: hasSetupPy
          }
        };
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Phát hiện .NET project
   */
  async detectDotNet() {
    try {
      const csprojFiles = await this.findFilesByExtension('.csproj');
      const vbprojFiles = await this.findFilesByExtension('.vbproj');
      const fsprojFiles = await this.findFilesByExtension('.fsproj');
      const slnFiles = await this.findFilesByExtension('.sln');
      
      const hasProjectFiles = csprojFiles.length > 0 || vbprojFiles.length > 0 || fsprojFiles.length > 0;
      const hasSolution = slnFiles.length > 0;
      
      if (hasProjectFiles || hasSolution) {
        return {
          detected: true,
          confidence: 'high',
          indicators: {
            csproj: csprojFiles.length,
            vbproj: vbprojFiles.length,
            fsproj: fsprojFiles.length,
            solution: slnFiles.length
          }
        };
      }
    } catch (error) {
      // Ignore errors
    }
    
    return { detected: false };
  }

  /**
   * Tìm files theo extension
   */
  async findFilesByExtension(extension) {
    try {
      const files = await fs.readdir(this.projectPath);
      return files.filter(file => file.endsWith(extension));
    } catch (error) {
      return [];
    }
  }

  /**
   * Xác định loại dự án chính
   */
  determinePrimaryType(detected) {
    const priorities = ['angular', 'springBoot', 'react', 'vue', 'nodejs', 'java', 'python', 'dotnet'];
    
    for (const type of priorities) {
      if (detected[type] && detected[type].confidence === 'high') {
        return type;
      }
    }
    
    // Fallback to first detected
    return Object.keys(detected)[0] || 'unknown';
  }
}

module.exports = ProjectDetector;
