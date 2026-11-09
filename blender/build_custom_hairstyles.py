"""
Generates game-ready 3D hairstyles fitted directly to the Blender Studio Stylized Character Heads:
1. Hair.Afro (Sculpted Volumetric Afro with tapered temples and clean nape)
2. Hair.Dreads (Tiered sculpted dreadlocks / locs draping naturally around the head)
3. Hair.Fade (Clean-cut modern educator fade with crisp lineup and sideburns)
4. Hair.SidePart (Textured professional side-part crop)
5. Hair.LongWaves (Flowing layered waves framing the face and shoulders)
6. Hair.HighBun (Gathered top-knot bun with sleek base)

Exported to client/public/models/hair/
"""

import bpy
import bmesh
from mathutils import Vector, Matrix, Euler
import math
import os

def create_hair_material(name, hex_color="#26170e", roughness=0.75):
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
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.05
    return mat

def get_head_center_and_radius(is_male=True):
    # Skull center in armature coordinates (meters)
    # Crown is ~1.794 (male) / 1.613 (female)
    # Eyes are ~1.578 (male) / 1.419 (female)
    if is_male:
        return Vector((0.0, -0.015, 1.66)), 0.108, 1.794, 1.578
    else:
        return Vector((0.0, -0.015, 1.49)), 0.096, 1.613, 1.419

def build_afro(bm, is_male=True):
    center, r, crown_z, eye_z = get_head_center_and_radius(is_male)
    
    # 1. Base scalp cap (covers cranium cleanly)
    bmesh.ops.create_uvsphere(
        bm, u_segments=24, v_segments=16,
        radius=r * 1.04,
        matrix=Matrix.Translation(center + Vector((0, 0.005, 0.01)))
    )
    # Delete lower hemisphere below ears/brow
    del_verts = [v for v in bm.verts if v.co.z < (center.z - 0.02) and (v.co.y < 0.04 or v.co.z < (center.z - 0.05))]
    bmesh.ops.delete(bm, geom=del_verts, context='VERTS')
    
    # 2. Main volumetric Afro mass
    # An organic elliptical volume, taller on top, tapered at sides and nape
    afro_center = center + Vector((0, 0.012, 0.045))
    afro_r_x = r * 1.32
    afro_r_y = r * 1.38
    afro_r_z = r * 1.42
    
    sphere = bmesh.ops.create_uvsphere(
        bm, u_segments=28, v_segments=20,
        radius=1.0,
        matrix=Matrix.Translation(afro_center)
    )
    
    # Scale sphere to elliptical afro shape with organic surface micro-curvatures
    for v in sphere['verts']:
        # Elliptical scale relative to afro_center
        dx = (v.co.x - afro_center.x) * afro_r_x
        dy = (v.co.y - afro_center.y) * afro_r_y
        dz = (v.co.z - afro_center.z) * afro_r_z
        
        # Subtle textured micro-volume lobes (mimics natural curly hair contour)
        ang = math.atan2(dx, dy)
        noise = math.sin(ang * 7.0) * 0.004 + math.cos(dz * 45.0) * 0.003
        
        v.co.x = afro_center.x + dx + noise
        v.co.y = afro_center.y + dy + noise
        v.co.z = afro_center.z + dz + (noise * 0.5)
        
    # Cut off inside/lower afro geometry so it doesn't clip through face
    del_afro = [v for v in sphere['verts'] if v.co.z < (eye_z + 0.02) and v.co.y < (center.y - 0.02)]
    bmesh.ops.delete(bm, geom=del_afro, context='VERTS')

def build_dreads(bm, is_male=True):
    center, r, crown_z, eye_z = get_head_center_and_radius(is_male)
    
    # 1. Base scalp cap (dark underlayer)
    bmesh.ops.create_uvsphere(
        bm, u_segments=22, v_segments=14,
        radius=r * 1.03,
        matrix=Matrix.Translation(center + Vector((0, 0.005, 0.01)))
    )
    del_base = [v for v in bm.verts if v.co.z < (eye_z + 0.01) and v.co.y < 0.0]
    bmesh.ops.delete(bm, geom=del_base, context='VERTS')
    
    # 2. Layered Locs (Dreadlock tubes)
    # 28 individual loc strands distributed across crown, sides, and back
    num_locs = 28
    for i in range(num_locs):
        phi = (i / num_locs) * math.tau  # Angle around head
        
        # Determine tier: crown (top), middle (temple/ears), lower (nape)
        tier = i % 3
        if tier == 0:
            # Top crown locs (flow outward then down)
            start_r = r * 0.65
            start_z = crown_z - 0.01
            length = 0.16
            loc_radius = 0.011
        elif tier == 1:
            # Middle locs (temple, side of head)
            start_r = r * 0.95
            start_z = crown_z - 0.06
            length = 0.22
            loc_radius = 0.010
        else:
            # Lower locs (back & nape)
            start_r = r * 0.98
            start_z = crown_z - 0.11
            length = 0.26
            loc_radius = 0.012
            
        start_x = center.x + math.sin(phi) * start_r
        start_y = center.y + math.cos(phi) * start_r
        
        # Don't place locs directly over face center
        if start_y < (center.y - 0.04) and abs(start_x) < 0.035:
            continue
            
        # Build multi-segment curved loc
        segments = 6
        points = []
        for s in range(segments + 1):
            frac = s / segments
            # Gravitational hang down + outward drape
            cur_z = start_z - (frac * length)
            out_factor = 1.0 + math.sin(frac * math.pi * 0.5) * 0.18
            cur_x = center.x + (start_x - center.x) * out_factor + (math.sin(frac * 6.0 + i) * 0.005)
            cur_y = center.y + (start_y - center.y) * out_factor + (math.cos(frac * 6.0 + i) * 0.005)
            points.append(Vector((cur_x, cur_y, cur_z)))
            
        # Extrude cylinder along points
        for s in range(segments):
            p1 = points[s]
            p2 = points[s + 1]
            diff = p2 - p1
            h = diff.length
            if h < 1e-4: continue
            mid = (p1 + p2) * 0.5
            
            # Rotation to point from p1 to p2
            rot = Vector((0, 0, 1)).rotation_difference(diff).to_matrix().to_4x4()
            mat = Matrix.Translation(mid) @ rot
            
            r_top = loc_radius * (1.0 - frac * 0.15)
            r_bot = loc_radius * (1.0 - (frac + 1/segments) * 0.15)
            
            bmesh.ops.create_cone(
                bm, cap_ends=(s == segments - 1 or s == 0), segments=8,
                radius1=r_bot, radius2=r_top, depth=h,
                matrix=mat
            )

def build_fade(bm, is_male=True):
    center, r, crown_z, eye_z = get_head_center_and_radius(is_male)
    
    # Clean-cut sculpted fade with crisp lineup
    cap = bmesh.ops.create_uvsphere(
        bm, u_segments=26, v_segments=18,
        radius=r * 1.045,
        matrix=Matrix.Translation(center + Vector((0, 0.002, 0.015)))
    )
    
    # Scale top for square / flat-top fade silhouette
    for v in cap['verts']:
        if v.co.z > (center.z + 0.04):
            v.co.z += 0.012  # Lift crown
            if abs(v.co.x) < 0.07:
                v.co.y += 0.006  # Crisp front ledge
                
    # Delete lower portions below hairline / temples
    del_fade = []
    for v in bm.verts:
        # Forehead hairline cutoff: clean horizontal edge above eyebrows
        if v.co.y < (center.y - 0.055) and v.co.z < (eye_z + 0.065):
            del_fade.append(v)
        # Ear arches
        elif abs(v.co.x) > (r * 0.92) and v.co.z < (eye_z + 0.03):
            del_fade.append(v)
        # Nape taper
        elif v.co.y > (center.y + 0.04) and v.co.z < (eye_z - 0.01):
            del_fade.append(v)
            
    bmesh.ops.delete(bm, geom=del_fade, context='VERTS')
    
    # Extrude rim inward to give thickness
    boundary_edges = [e for e in bm.edges if e.is_boundary]
    if boundary_edges:
        ret = bmesh.ops.extrude_edge_only(bm, edges=boundary_edges)
        for v in ret['geom']:
            if isinstance(v, bmesh.types.BMVert):
                v.co -= (v.co - center).normalized() * 0.006

def build_sidepart(bm, is_male=True):
    center, r, crown_z, eye_z = get_head_center_and_radius(is_male)
    
    # Base skull cap
    bmesh.ops.create_uvsphere(
        bm, u_segments=26, v_segments=18,
        radius=r * 1.04,
        matrix=Matrix.Translation(center + Vector((0, 0.003, 0.012)))
    )
    
    # Part line on Left side (X = -0.04m), hair swept up and over to Right
    for v in bm.verts:
        if v.co.z > (center.z + 0.03):
            if v.co.x > -0.02:
                # Right side volume lift
                v.co.z += 0.020
                v.co.x += 0.010
            elif v.co.x < -0.04:
                # Left side part taper
                v.co.z -= 0.004
                
    del_part = []
    for v in bm.verts:
        # Front fringe sweep: covers left side of brow slightly, higher on right
        fringe_z = eye_z + 0.065 + (v.co.x * 0.08)
        if v.co.y < (center.y - 0.05) and v.co.z < fringe_z:
            del_part.append(v)
        elif abs(v.co.x) > (r * 0.90) and v.co.z < (eye_z + 0.025):
            del_part.append(v)
        elif v.co.y > (center.y + 0.04) and v.co.z < (eye_z - 0.015):
            del_part.append(v)
            
    bmesh.ops.delete(bm, geom=del_part, context='VERTS')

def build_longwaves(bm, is_male=False):
    center, r, crown_z, eye_z = get_head_center_and_radius(is_male)
    
    # Crown cap
    bmesh.ops.create_uvsphere(
        bm, u_segments=26, v_segments=18,
        radius=r * 1.05,
        matrix=Matrix.Translation(center + Vector((0, 0.004, 0.015)))
    )
    del_top = [v for v in bm.verts if v.co.y < (center.y - 0.05) and v.co.z < (eye_z + 0.06)]
    bmesh.ops.delete(bm, geom=del_top, context='VERTS')
    
    # Flowing wave strands down Left, Right, and Back
    wave_strands = [
        (-0.08, -0.02, 0.36),
        (-0.09, 0.02, 0.40),
        (-0.06, 0.07, 0.44),
        (0.0, 0.085, 0.46),
        (0.06, 0.07, 0.44),
        (0.09, 0.02, 0.40),
        (0.08, -0.02, 0.36),
    ]
    
    for sx, sy, drop_len in wave_strands:
        pts = []
        segs = 8
        for s in range(segs + 1):
            t = s / segs
            cz = (crown_z - 0.08) - (t * drop_len)
            wave = math.sin(t * math.pi * 3.5) * 0.015
            cx = center.x + sx + (wave * 0.6) + (0.015 if sx > 0 else -0.015) * t
            cy = center.y + sy + wave + (0.02 * t)
            pts.append(Vector((cx, cy, cz)))
            
        for s in range(segs):
            p1 = pts[s]
            p2 = pts[s + 1]
            diff = p2 - p1
            h = diff.length
            if h < 1e-4: continue
            rot = Vector((0, 0, 1)).rotation_difference(diff).to_matrix().to_4x4()
            mat = Matrix.Translation((p1 + p2) * 0.5) @ rot
            rw = 0.022 * (1.0 - (s / segs) * 0.3)
            bmesh.ops.create_cone(
                bm, cap_ends=True, segments=8,
                radius1=rw * 0.85, radius2=rw, depth=h,
                matrix=mat
            )

def build_highbun(bm, is_male=False):
    center, r, crown_z, eye_z = get_head_center_and_radius(is_male)
    
    # Sleek base skull cap
    bmesh.ops.create_uvsphere(
        bm, u_segments=26, v_segments=18,
        radius=r * 1.035,
        matrix=Matrix.Translation(center + Vector((0, 0.003, 0.012)))
    )
    del_bun_base = []
    for v in bm.verts:
        if v.co.y < (center.y - 0.055) and v.co.z < (eye_z + 0.065):
            del_bun_base.append(v)
        elif abs(v.co.x) > (r * 0.90) and v.co.z < (eye_z + 0.025):
            del_bun_base.append(v)
        elif v.co.y > (center.y + 0.04) and v.co.z < (eye_z - 0.015):
            del_bun_base.append(v)
    bmesh.ops.delete(bm, geom=del_bun_base, context='VERTS')
    
    # Top Knot Bun on Crown
    bun_center = center + Vector((0, -0.015, (crown_z - center.z) + 0.055))
    bmesh.ops.create_uvsphere(
        bm, u_segments=20, v_segments=16,
        radius=0.052,
        matrix=Matrix.Translation(bun_center)
    )
    
    # Wrap ring around base of bun
    bmesh.ops.create_cone(
        bm, cap_ends=False, segments=18,
        radius1=0.046, radius2=0.048, depth=0.018,
        matrix=Matrix.Translation(bun_center - Vector((0, 0, 0.038)))
    )

BUILDERS = {
    "Hair.Afro": build_afro,
    "Hair.Dreads": build_dreads,
    "Hair.Fade": build_fade,
    "Hair.SidePart": build_sidepart,
    "Hair.LongWaves": build_longwaves,
    "Hair.HighBun": build_highbun,
}

def build_and_export_all_hairstyles():
    out_dir = r"c:\ELD_PD_Game\client\public\models\hair"
    os.makedirs(out_dir, exist_ok=True)
    
    for hair_id, builder_fn in BUILDERS.items():
        for gender in ("male", "female"):
            is_male = (gender == "male")
            bpy.ops.wm.read_factory_settings(use_empty=True)
            
            bm = bmesh.new()
            builder_fn(bm, is_male)
            
            # Smooth all polygons
            for f in bm.faces:
                f.smooth = True
                
            mesh_name = f"{hair_id}_{gender.capitalize()}"
            me = bpy.data.meshes.new(mesh_name)
            bm.to_mesh(me)
            bm.free()
            
            obj = bpy.data.objects.new(mesh_name, me)
            bpy.context.scene.collection.objects.link(obj)
            
            # Assign PBR Hair Material
            mat = create_hair_material("Mat_Hair", "#26170e")
            obj.data.materials.append(mat)
            
            # Export standalone GLB
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
            
    print("ALL HAIRSTYLES GENERATED AND EXPORTED SUCCESSFULLY!")

if __name__ == "__main__":
    build_and_export_all_hairstyles()

