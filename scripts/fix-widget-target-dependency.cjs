const { IOSConfig } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

async function main() {
  const projectRoot = process.cwd();
  const pbxPath = path.join(projectRoot, 'ios/aaelhalzydan.xcodeproj/project.pbxproj');
  const project = IOSConfig.XcodeUtils.getPbxproj(projectRoot);

  const projObjects = project.hash.project.objects;
  projObjects.PBXTargetDependency = projObjects.PBXTargetDependency || {};
  projObjects.PBXContainerItemProxy = projObjects.PBXContainerItemProxy || {};

  const [appTargetUuid, appTarget] = IOSConfig.Target.findNativeTargetByName(project, 'aaelhalzydan');
  const [widgetTargetUuid] = IOSConfig.Target.findNativeTargetByName(project, 'AlzidanFamilyWidgetExtension');

  const hasDep = (appTarget.dependencies || []).some(dep => {
    const item = project.getPBXGroupByKeyAndType(dep.value, 'PBXTargetDependency');
    const proxy = project.getPBXGroupByKeyAndType(item.targetProxy, 'PBXContainerItemProxy');
    return proxy.remoteGlobalIDString === widgetTargetUuid;
  });

  if (hasDep) {
    console.log('Dependency already exists');
  } else {
    project.addTargetDependency(appTargetUuid, [widgetTargetUuid]);
    fs.writeFileSync(pbxPath, project.writeSync());
    console.log('Added PBXTargetDependency from aaelhalzydan -> AlzidanFamilyWidgetExtension');
  }

  const target = await IOSConfig.Target.findApplicationTargetWithDependenciesAsync(
    projectRoot,
    'aaelhalzydan'
  );
  console.log(
    'Dependencies after fix:',
    JSON.stringify(
      target.dependencies?.map(d => ({ name: d.name, signable: d.signable })),
      null,
      2
    )
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
