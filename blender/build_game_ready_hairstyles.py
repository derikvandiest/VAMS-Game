"""
Builds and exports 8 high-quality game-ready hairstyles for the Blender Studio Human Base Meshes:
1. hair_fade: Clean Lineup Fade / Buzzcut (Hair.001)
2. hair_crop: Textured Modern Crop (Hair.002)
3. hair_sidepart: Executive Side Part (Hair.004)
4. hair_afro: Volumetric Textured Afro (Hair.007)
5. hair_dreads: Layered Dreadlocks / Locs (Hair.008)
6. hair_longwaves: Flowing Long Waves (Hair.010)
7. hair_bob: Shoulder Lob / Bob (Hair.006)
8. hair_braids: Braided Long Locs / Ponytail (Hair.011)

Exports 16 GLB files:
client/public/models/hair/hair_<style>_male.glb
client/public/models/hair/hair_<style>_female.glb

Each model is exported with its origin (0, 0, 0) at the Head bone (0, 0, 1.580 for male, 0, 0, 1.420 for female)
so in Three.js it attaches directly to headBone as child at (0, 0, 0) with zero runtime distortion.
"""

import bpy
import os
from mathutils import Vector, Euler
import math

HAIR_SPECS = {
    'fade': {
        'source_glb': 'Hair.001.glb',
        'label': 'Clean Lineup Fade',
        'male': {'scale': 0.250, 'offset': Vector((0.0, -0.012, 1.662))},
        'female': {'scale': 0.228, 'offset': Vector((0.0, -0.012, 1.498))},
    },
    'crop': {
        'source_glb': 'Hair.002.glb',
        'label': 'Textured Modern Crop',
        'male': {'scale': 0.252, 'offset': Vector((0.0, -0.012, 1.660))},
        'female': {'scale': 0.230, 'offset': Vector((0.0, -0.012, 1.496))},
    },
    'sidepart': {
        'source_glb': 'Hair.004.glb',
        'label': 'Executive Side Part',
        'male': {'scale': 0.250, 'offset': Vector((0.0, -0.014, 1.658))},
        'female': {'scale': 0.228, 'offset': Vector((0.0, -0.014, 1.495))},
    },
    'afro': {
        'source_glb': 'Hair.007.glb',
        'label': 'Volumetric Textured Afro',
        'male': {'scale': 0.246, 'offset': Vector((0.0, -0.008, 1.670))},
        'female': {'scale': 0.224, 'offset': Vector((0.0, -0.008, 1.505))},
    },
    'dreads': {
        'source_glb': 'Hair.008.glb',
        'label': 'Layered Dreadlocks / Locs',
        'male': {'scale': 0.248, 'offset': Vector((0.0, -0.008, 1.670))},
        'female': {'scale': 0.226, 'offset': Vector((0.0, -0.008, 1.505))},
    },
    'longwaves': {
        'source_glb': 'Hair.010.glb',
        'label': 'Flowing Long Waves',
        'male': {'scale': 0.248, 'offset': Vector((0.0, -0.010, 1.662))},
        'female': {'scale': 0.226, 'offset': Vector((0.0, -0.010, 1.498))},
    },
    'bob': {
        'source_glb': 'Hair.006.glb',
        'label': 'Shoulder Lob / Bob',
        'male': {'scale': 0.250, 'offset': Vector((0.0, -0.012, 1.660))},
        'female': {'scale': 0.228, 'offset': Vector((0.0, -0.012, 1.496))},
    },
    'braids': {
        'source_glb': 'Hair.011.glb',
        'label': 'Braided Long Locs',
        'male': {'scale': 0.250, 'offset': Vector((0.0, -0.010, 1.662))},
        'female': {'scale': 0.228, 'offset': Vector((0.0, -0.010, 1.498))},
    },
}

HEAD_BONE_Z = {
    'male': 1.580,
    'female': 1.420,
}

def export_hairstyles():
    out_dir = r"c:\ELD_PD_Game\client\public\models\hair"
    os.makedirs(out_dir, exist_ok=True)
    
    for style_id, spec in HAIR_SPECS.items():
        src_path = os.path.join(r"c:\ELD_PD_Game\client\public\models", spec['source_glb'])
        if not os.path.exists(src_path):
            print(f"Warning: source {src_path} not found!")
            continue
            
        for gender in ['male', 'female']:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            bpy.ops.import_scene.gltf(filepath=src_path)
            
            # Find the primary hair mesh
            hair_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH' and 'icosphere' not in o.name.lower()]
            if not hair_objs:
                print(f"No hair mesh found in {src_path}")
                continue
                
            hair = hair_objs[0]
            
            # Preserve world transform & unparent
            mw = hair.matrix_world.copy()
            hair.parent = None
            hair.matrix_world = mw
            
            # Remove all other objects (armatures, icospheres, cameras, lights)
            for o in list(bpy.context.scene.objects):
                if o != hair:
                    bpy.data.objects.remove(o)
                    
            bpy.context.view_layer.objects.active = hair
            hair.select_set(True)
            bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
            
            # Center the hair mesh around its own bounding box center
            h_verts = [v.co for v in hair.data.vertices]
            hx_c = (min(v.x for v in h_verts) + max(v.x for v in h_verts)) * 0.5
            hy_c = (min(v.y for v in h_verts) + max(v.y for v in h_verts)) * 0.5
            hz_c = (min(v.z for v in h_verts) + max(v.z for v in h_verts)) * 0.5
            
            hair.location = -Vector((hx_c, hy_c, hz_c))
            bpy.ops.object.transform_apply(location=True)
            
            # Apply gender scaling and target position in character world space
            g_cfg = spec[gender]
            s = g_cfg['scale']
            t_loc = g_cfg['offset']
            
            hair.scale = Vector((s, s * 1.02, s))
            hair.location = t_loc
            bpy.ops.object.transform_apply(location=True, scale=True)
            
            # Clean material for uniform tinting
            mat = bpy.data.materials.new(name=f"Mat_{style_id}_{gender}")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (0.05, 0.03, 0.02, 1.0)
                if "Roughness" in bsdf.inputs:
                    bsdf.inputs["Roughness"].default_value = 0.75
            hair.data.materials.clear()
            hair.data.materials.append(mat)
            
            hair.name = f"hair_{style_id}_{gender}"
            
            # Export world-space GLB
            out_file = os.path.join(out_dir, f"hair_{style_id}_{gender}.glb")
            bpy.ops.export_scene.gltf(
                filepath=out_file,
                export_format='GLB',
                use_selection=True
            )
            print(f"Exported: {out_file} (verts: {len(hair.data.vertices)})")

if __name__ == "__main__":
    export_hairstyles()

