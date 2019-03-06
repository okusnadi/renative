import path from 'path';
import fs from 'fs';
import {
    isPlatformSupported, getConfig, logTask, logComplete,
    logError, getAppFolder, isPlatformActive, logWarning, configureIfRequired,
} from '../common';
import {
    IOS, ANDROID, TVOS, TIZEN, WEBOS, ANDROID_TV, ANDROID_WEAR, WEB, MACOS,
    WINDOWS, TIZEN_WATCH, KAIOS, RNV_APP_CONFIG_NAME,
} from '../constants';
import { runPod, copyAppleAssets, configureXcodeProject } from '../platformTools/apple';
import { configureGradleProject, configureAndroidProperties } from '../platformTools/android';
import { configureTizenProject, createDevelopTizenCertificate } from '../platformTools/tizen';
import { configureWebOSProject } from '../platformTools/webos';
import { configureElectronProject } from '../platformTools/electron';
import { configureKaiOSProject } from '../platformTools/kaios';
import { configureWebProject } from '../platformTools/web';
import { cleanFolder, copyFolderContentsRecursiveSync, copyFolderRecursiveSync, copyFileSync, mkdirSync } from '../fileutils';
import platformRunner from './platform';

const CONFIGURE = 'configure';
const SWITCH = 'switch';
const CREATE = 'create';
const REMOVE = 'remove';
const LIST = 'list';
const INFO = 'info';

// ##########################################
// PUBLIC API
// ##########################################

const run = (c) => {
    logTask('run');

    switch (c.subCommand) {
    case CONFIGURE:
        return _runConfigure(c);
        break;
    case SWITCH:
        return Promise.resolve();
        break;
    case CREATE:
        return Promise.resolve();
        break;
    case REMOVE:
        return Promise.resolve();
        break;
    case LIST:
        return Promise.resolve();
        break;
    case INFO:
        return Promise.resolve();
        break;
    default:
        return Promise.reject(`Sub-Command ${c.subCommand} not supported`);
    }
};

// ##########################################
//  PRIVATE
// ##########################################

const _runConfigure = c => new Promise((resolve, reject) => {
    logTask('_runConfigure');

    _runSetupGlobalSettings(c)
        .then(() => _checkAndCreatePlatforms(c))
        .then(() => copyRuntimeAssets(c))
        .then(() => _runPlugins(c))
        .then(() => configureAndroidProperties(c))
        .then(() => configureGradleProject(c, ANDROID))
        .then(() => configureGradleProject(c, ANDROID_TV))
        .then(() => configureGradleProject(c, ANDROID_WEAR))
        .then(() => configureTizenProject(c, TIZEN))
        .then(() => configureTizenProject(c, TIZEN_WATCH))
        .then(() => configureWebOSProject(c, WEBOS))
        .then(() => configureWebProject(c, WEB))
        .then(() => configureElectronProject(c, MACOS))
        .then(() => configureElectronProject(c, WINDOWS))
        .then(() => configureKaiOSProject(c, KAIOS))
        .then(() => configureXcodeProject(c, IOS, 'RNVApp'))
        .then(() => configureXcodeProject(c, TVOS, 'RNVAppTVOS'))
        .then(() => resolve())
        .catch(e => reject(e));
});

const _runSetupTizenProject = (c, platform) => new Promise((resolve, reject) => {
    logTask(`_runSetupTizenProject:${platform}`);
    if (!isPlatformActive(c, platform, resolve)) return;

    copyTizenAssets(c, platform)
        .then(() => configureTizenProject(c, platform))
        .then(() => resolve())
        .catch(e => reject(e));
});

const _runSetupWebOSProject = (c, platform) => new Promise((resolve, reject) => {
    logTask(`_runSetupWebOSProject:${platform}`);
    if (!isPlatformActive(c, platform, resolve)) return;

    copyWebOSAssets(c, platform)
        .then(() => configureWebOSProject(c, platform))
        .then(() => resolve())
        .catch(e => reject(e));
});

const _runSetupWebProject = (c, platform) => new Promise((resolve, reject) => {
    logTask(`_runSetupWebProject:${platform}`);
    if (!isPlatformActive(c, platform, resolve)) return;

    resolve();
});

const _runSetupElectronProject = (c, platform) => new Promise((resolve, reject) => {
    logTask(`_runSetupElectronProject:${platform}`);
    if (!isPlatformActive(c, platform, resolve)) return;

    configureElectronProject(c, platform)
        .then(() => resolve())
        .catch(e => reject(e));

    resolve();
});


const _runSetupGlobalSettings = c => new Promise((resolve, reject) => {
    logTask('_runSetupGlobalSettings');

    if (isPlatformActive(c, TIZEN)) {
        const tizenAuthorCert = path.join(c.globalConfigFolder, 'tizen_author.p12');
        if (fs.existsSync(tizenAuthorCert)) {
            console.log('tizen_author.p12 file exists!');
            resolve();
        } else {
            console.log('tizen_author.p12 file missing! Creating one for you...');
            createDevelopTizenCertificate(c).then(() => resolve()).catch(e => reject(e));
        }
    }
});

const _checkAndCreatePlatforms = c => new Promise((resolve, reject) => {
    logTask('_checkAndCreatePlatforms');

    if (!fs.existsSync(c.platformBuildsFolder)) {
        logWarning('Platforms not created yet. creating them for you...');

        const newCommand = Object.assign({}, c);
        newCommand.subCommand = 'configure';
        newCommand.program = { appConfig: 'helloWorld' };

        platformRunner(newCommand)
            .then(() => resolve())
            .catch(e => reject(e));

        return;
    }
    resolve();
});

const copyRuntimeAssets = c => new Promise((resolve, reject) => {
    logTask('copyRuntimeAssets');
    const aPath = path.join(c.platformAssetsFolder, 'runtime');
    const cPath = path.join(c.appConfigFolder, 'assets/runtime');
    copyFolderContentsRecursiveSync(cPath, aPath);

    copyFileSync(c.appConfigPath, path.join(c.platformAssetsFolder, RNV_APP_CONFIG_NAME));
    resolve();
});


const _runPlugins = c => new Promise((resolve, reject) => {
    logTask('_runPlugins');

    const pluginsPath = path.resolve(c.rnvFolder, 'plugins');

    fs.readdirSync(pluginsPath).forEach((dir) => {
        const pp = path.resolve(pluginsPath, dir, 'overrides');
        fs.readdirSync(pp).forEach((file) => {
            copyFileSync(path.resolve(pp, file), path.resolve(c.projectRootFolder, 'node_modules', dir));
        });
    });
    resolve();
});

export { copyRuntimeAssets };

export default run;