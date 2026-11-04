"""Convert the user supplied FBX cars to self-contained web assets.
Run: blender -b -t 2 --python tools/convert-car-assets.py -- <Fennec.fbx> <Scorpion.fbx>
The originals stay outside the web download; GLBs contain their supported textures.
"""
import bpy, sys, math
from pathlib import Path
from mathutils import Matrix, Vector

root = Path(__file__).resolve().parents[1]
sources = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(sources) != 2:
    raise SystemExit('Supply Fennec.fbx and Scorpion.fbx after --')
for kind, source in zip(('fennec', 'scorpion'), sources):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(Path(source).resolve()))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    rotation = Matrix.Rotation(-math.pi / 2, 4, 'Z') if kind == 'fennec' else Matrix.Identity(4)
    for obj in meshes:
        world = rotation @ obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        obj.data.transform(world)
        is_wheel = obj.name.startswith('Alpha -') if kind == 'fennec' else obj.name.startswith('mesh_120.')
        if is_wheel:
            coords = [v.co for v in obj.data.vertices]
            center = Vector([(min(v[i] for v in coords) + max(v[i] for v in coords)) / 2 for i in range(3)])
            obj.data.transform(Matrix.Translation(-center))
            obj.location = center
            obj.name = 'Wheel_' + ('L' if center.x < 0 else 'R') + ('F' if center.y < (-5 if kind == 'scorpion' else 0) else 'B')
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH': bpy.data.objects.remove(obj, do_unlink=True)
    for mat in bpy.data.materials:
        if not mat.use_nodes: continue
        nodes = mat.node_tree.nodes
        shader = next(n for n in nodes if n.type == 'BSDF_PRINCIPLED')
        # FBX references missing external maps in Fennec. Remove only those links.
        for node in list(nodes):
            if node.type == 'TEX_IMAGE' and (not node.image or not node.image.size[0]):
                nodes.remove(node)
        if (kind == 'fennec' and mat.name == 'Fennec - Body') or (kind == 'scorpion' and mat.name == 'mat_6.002'):
            mat.name = 'BodyPaint'
            shader.inputs['Base Color'].default_value = (0.04, 0.4, 0.8, 1)
            shader.inputs['Metallic'].default_value = 0.3
            shader.inputs['Roughness'].default_value = 0.3
        if kind == 'scorpion' and mat.name == 'Glass':
            shader.inputs['Base Color'].default_value = (0.012, 0.026, 0.04, 1)
            shader.inputs['Roughness'].default_value = 0.18
            shader.inputs['Metallic'].default_value = 0.25
        # Source Scorpion textures are already embedded; keep maps and UVs intact.
    # Match Octane's external glTF loading path for Scorpion. Smaller separate
    # image files avoid one large embedded-image decode on mobile browsers.
    if kind == 'scorpion':
        for image in bpy.data.images:
            if max(image.size) > 1024:
                factor = 1024 / max(image.size)
                image.scale(max(1, round(image.size[0] * factor)), max(1, round(image.size[1] * factor)))
    target = root / 'assets' / kind / ('scene.gltf' if kind == 'scorpion' else 'scene.glb')
    bpy.ops.export_scene.gltf(filepath=str(target), export_format='GLTF_SEPARATE' if kind == 'scorpion' else 'GLB', export_yup=True,
        export_animations=False, export_cameras=False, export_lights=False)
    print('EXPORTED', kind, target.stat().st_size)
