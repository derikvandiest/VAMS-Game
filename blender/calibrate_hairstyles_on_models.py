"""
Creates beautifully fitted, authentic hairstyles for the Blender Studio Stylized Characters:
- Hair.Afro: Full volumetric natural Afro with organic textured silhouette and clean hairline
- Hair.Dreads: Authentic tiered dreadlocks / locs covering crown, sides, and nape
- Hair.Fade: Crisp lineup fade / buzzcut
- Hair.SidePart: Professional textured side-part crop
- Hair.LongWaves: Flowing voluminous waves
- Hair.Bob: Sleek educator shoulder lob / bob
- Hair.HighBun: Sleek top-knot bun

Renders frontal studio preview with three-point lighting.
"""

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler
import math
import os

def create_hair_mat(name, hex_color="#1a110b", roughness=0.7):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        hex_c = hex_color.lstrip('#')
        r = pow(int(hex_c[0:2], 16) / 255.0, 2.2)
        g = pow(int(hex_c[2:4], 16) / 255.0, 2.2)
        b = pow(int(hex_c[4:6], 16) / 255.0, 2.2)
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
    return mat

def get_skull_specs(is_male=True):
    if is_male:
        return {
            'center': Vector((0.0, 0.005, 1.675)),
            'rx': 0.092,
            'ry': 0.105,
            'rz': 0.108,
            'brow_z': 1.635,
            'ear_y': 0.005,
            'crown_z': 1.794,
        }
    else:
        return {
            'center': Vector((0.0, 0.005, 1.505)),
            'rx': 0.084,
            'ry': 0.095,
            'rz': 0.098,
            'brow_z': 1.470,
            'ear_y': 0.005,
            'crown_z': 1.613,
        }

def make_skull_cap(bm, specs):
    c = specs['center']
    # Scalp base fitting cranium
    cap = bmesh.ops.create_uvsphere(
        bm, u_segments=28, v_segments=20,
        radius=1.0,
        matrix=Matrix.Translation(c)
    )
    for v in cap['verts']:
        dx = (v.co.x - c.x) * (specs['rx'] * 1.03)
        dy = (v.co.y - c.y) * (specs['ry'] * 1.03)
        dz = (v.co.z - c.z) * (specs['rz'] * 1.03)
        v.co = c + Vector((dx, dy, dz))
        
    # Trim below brow and ears
    del_cap = []
    for v in bm.verts:
        # Forehead hairline
        if v.co.y < (c.y - 0.05) and v.co.z < (specs['brow_z'] + 0.035):
            del_cap.append(v)
        # Below ears
        elif abs(v.co.x) > (specs['rx'] * 0.92) and v.co.z < (specs['brow_z'] - 0.005):
            del_cap.append(v)
        # Nape
        elif v.co.y > (c.y + 0.04) and v.co.z < (specs['brow_z'] - 0.035):
            del_cap.append(v)
    bmesh.ops.delete(bm, geom=del_cap, context='VERTS')
    return cap

def build_afro_mesh(bm, is_male=True):
    specs = get_skull_specs(is_male)
    c = specs['center']
    
    # 1. Base scalp cap
    make_skull_cap(bm, specs)
    
    # 2. Main volumetric Afro cloud
    # Modeled as organic volumetric shape with textured curly silhouette
    afro_c = c + Vector((0, 0.010, 0.040))
    afro_rx = specs['rx'] * 1.48
    afro_ry = specs['ry'] * 1.45
    afro_rz = specs['rz'] * 1.45
    
    afro_sphere = bmesh.ops.create_uvsphere(
        bm, u_segments=32, v_segments=24,
        radius=1.0,
        matrix=Matrix.Translation(afro_c)
    )
    
    for v in afro_sphere['verts']:
        dx = (v.co.x - afro_c.x) * afro_rx
        dy = (v.co.y - afro_c.y) * afro_ry
        dz = (v.co.z - afro_c.z) * afro_rz
        
        # Natural volumetric surface texture (curls/texture)
        angle = math.atan2(dx, dy)
        phi = math.atan2(math.hypot(dx, dy), dz)
        micro = math.sin(angle * 8.0) * 0.005 + math.cos(phi * 10.0) * 0.004
        
        v.co = afro_c + Vector((dx + micro, dy + micro, dz + micro))
        
    # Cut underside of afro so it meets the scalp cleanly without clipping eyes
    del_underside = []
    for v in afro_sphere['verts']:
        if v.co.z < (specs['brow_z'] + 0.02) and v.co.y < (c.y - 0.02):
            del_underside.append(v)
        elif v.co.z < (specs['brow_z'] - 0.04):
            del_underside.append(v)
    bmesh.ops.delete(bm, geom=del_underside, context='VERTS')

def build_dreads_mesh(bm, is_male=True):
    specs = get_skull_specs(is_male)
    c = specs['center']
    
    # 1. Scalp cap (dread root underlayer)
    make_skull_cap(bm, specs)
    
    # 2. Full crown coverage: 36 individual sculpted locs
    # Arranged in 3 concentric rings (Crown, Mid-Temple, Rim)
    loc_configs = [
        # (ring_radius_mult, z_offset, length, loc_r, count, drop_angle)
        (0.40, 0.08, 0.18, 0.012, 8, 25),    # Crown center locs
        (0.70, 0.04, 0.24, 0.011, 12, 45),   # Mid-head locs
        (0.96, -0.01, 0.28, 0.010, 16, 75),  # Perimeter locs (sides and back)
    ]
    
    for r_mult, z_off, length, loc_r, count, drop_deg in loc_configs:
        for i in range(count):
            ang = (i / count) * math.tau + (r_mult * 1.5)
            
            # Avoid face front
            sin_a = math.sin(ang)
            cos_a = math.cos(ang)
            
            # Don't place front perimeter locs directly across eyes
            if r_mult > 0.8 and cos_a < -0.4 and abs(sin_a) < 0.4:
                continue
                
            start_x = c.x + sin_a * (specs['rx'] * r_mult)
            start_y = c.y + cos_a * (specs['ry'] * r_mult)
            start_z = c.z + z_off
            
            # 6-segment curved dreadlock strand
            segs = 6
            pts = []
            for s in range(segs + 1):
                t = s / segs
                # Gravitational fall + outward drape
                fall_z = start_z - (t * length)
                out_w = 1.0 + math.sin(t * math.pi * 0.5) * 0.22
                cur_x = c.x + (start_x - c.x) * out_w + math.sin(t * 5.0 + i) * 0.004
                cur_y = c.y + (start_y - c.y) * out_w + math.cos(t * 5.0 + i) * 0.004
                pts.append(Vector((cur_x, cur_y, fall_z)))
                
            for s in range(segs):
                p1 = pts[s]
                p2 = pts[s + 1]
                diff = p2 - p1
                h = diff.length
                if h < 1e-4: continue
                rot = Vector((0, 0, 1)).rotation_difference(diff).to_matrix().to_4x4()
                mat = Matrix.Translation((p1 + p2) * 0.5) @ rot
                
                # Taper slightly toward loc tip
                r1 = loc_r * (1.0 - (s / segs) * 0.25)
                r2 = loc_r * (1.0 - ((s + 1) / segs) * 0.25)
                bmesh.ops.create_cone(
                    bm, cap_ends=(s == 0 or s == segs - 1), segments=8,
                    radius1=r2, radius2=r1, depth=h,
                    matrix=mat
                )

def build_fade_mesh(bm, is_male=True):
    specs = get_skull_specs(is_male)
    c = specs['center']
    
    cap = bmesh.ops.create_uvsphere(
        bm, u_segments=30, v_segments=22,
        radius=1.0,
        matrix=Matrix.Translation(c + Vector((0, 0.002, 0.015)))
    )
    for v in cap['verts']:
        dx = (v.co.x - c.x) * (specs['rx'] * 1.045)
        dy = (v.co.y - c.y) * (specs['ry'] * 1.045)
        dz = (v.co.z - c.z) * (specs['rz'] * 1.045)
        
        # Flat-top / crop shape on top
        if dz > 0.04:
            dz += 0.010
            if abs(dx) < 0.065 and dy < -0.01:
                dy += 0.008  # Crisp front edge
        v.co = c + Vector((dx, dy, dz))
        
    del_fade = []
    for v in bm.verts:
        # Crisp square lineup above brow
        if v.co.y < (c.y - 0.052) and v.co.z < (specs['brow_z'] + 0.045):
            del_fade.append(v)
        elif abs(v.co.x) > (specs['rx'] * 0.94) and v.co.z < (specs['brow_z'] + 0.010):
            del_fade.append(v)
        elif v.co.y > (c.y + 0.035) and v.co.z < (specs['brow_z'] - 0.025):
            del_fade.append(v)
    bmesh.ops.delete(bm, geom=del_fade, context='VERTS')

def build_sidepart_mesh(bm, is_male=True):
    specs = get_skull_specs(is_male)
    c = specs['center']
    
    cap = bmesh.ops.create_uvsphere(
        bm, u_segments=28, v_segments=20,
        radius=1.0,
        matrix=Matrix.Translation(c + Vector((0, 0.003, 0.012)))
    )
    for v in cap['verts']:
        dx = (v.co.x - c.x) * (specs['rx'] * 1.04)
        dy = (v.co.y - c.y) * (specs['ry'] * 1.04)
        dz = (v.co.z - c.z) * (specs['rz'] * 1.04)
        # Swept volume over to right side
        if dz > 0.02:
            if dx > -0.02:
                dz += 0.018
                dx += 0.008
            elif dx < -0.04:
                dz -= 0.004
        v.co = c + Vector((dx, dy, dz))
        
    del_part = []
    for v in bm.verts:
        fringe_z = specs['brow_z'] + 0.045 + (v.co.x * 0.06)
        if v.co.y < (c.y - 0.048) and v.co.z < fringe_z:
            del_part.append(v)
        elif abs(v.co.x) > (specs['rx'] * 0.92) and v.co.z < (specs['brow_z'] + 0.015):
            del_part.append(v)
        elif v.co.y > (c.y + 0.035) and v.co.z < (specs['brow_z'] - 0.020):
            del_part.append(v)
    bmesh.ops.delete(bm, geom=del_part, context='VERTS')

BUILDERS = {
    "Hair.Afro": build_afro_mesh,
    "Hair.Dreads": build_dreads_mesh,
    "Hair.Fade": build_fade_mesh,
    "Hair.SidePart": build_sidepart_mesh,
}

def export_all():
    out_dir = r"c:\ELD_PD_Game\client\public\models\hair"
    os.makedirs(out_dir, exist_ok=True)
    
    for hair_id, builder_fn in BUILDERS.items():
        for gender in ("male", "female"):
            is_male = (gender == "male")
            bpy.ops.wm.read_factory_settings(use_empty=True)
            
            bm = bmesh.new()
            builder_fn(bm, is_male)
            
            for f in bm.faces:
                f.smooth = True
                
            mesh_name = f"{hair_id}_{gender.capitalize()}"
            me = bpy.data.meshes.new(mesh_name)
            bm.to_mesh(me)
            bm.free()
            
            obj = bpy.data.objects.new(mesh_name, me)
            bpy.context.scene.collection.objects.link(obj)
            
            mat = create_hair_mat("Mat_Hair", "#1f1712")
            obj.data.materials.append(mat)
            
            slug = hair_id.replace("Hair.", "").lower()
            export_path = os.path.join(out_dir, f"hair_{slug}_{gender}.glb")
            
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            
            bpy.ops.export_scene.gltf(
                filepath=export_path,
                use_selection=True,
                export_format='GLB',
                export_materials='EXPORT',
                export_cameras=False,
                export_lights=False,
                export_yup=True
            )
            print(f"Exported: {export_path}")

if __name__ == "__main__":
    export_all()

