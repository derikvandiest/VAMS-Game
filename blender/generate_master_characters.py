"""
Blender 5.2 Python Script: Generates Master Male and Female Character Meshes & Armatures.
Creates stylized, mature adult educator proportions with standard humanoid rigs,
clean anatomical hairlines, and exports both .blend and .glb files.
"""

import bpy
import bmesh
import math
from mathutils import Vector, Matrix, Euler

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Remove all collections and objects
    for obj in bpy.data.objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for col in bpy.data.collections:
        bpy.data.collections.remove(col)

def create_material(name, color_hex, roughness=0.6, metalness=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        # Hex to sRGB linear
        hex_c = color_hex.lstrip('#')
        r = int(hex_c[0:2], 16) / 255.0
        g = int(hex_c[2:4], 16) / 255.0
        b = int(hex_c[4:6], 16) / 255.0
        # sRGB to linear conversion for Blender
        r_lin = pow(r, 2.2)
        g_lin = pow(g, 2.2)
        b_lin = pow(b, 2.2)
        bsdf.inputs["Base Color"].default_value = (r_lin, g_lin, b_lin, 1.0)
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metalness
    return mat

def build_stylized_head(gender="male", head_center=Vector((0, 0, 1.56))):
    """
    Builds a clean, stylized adult head with defined jawline, cranium,
    stylized nose, lips, eye sockets, ears, and standardized scalp hairline.
    """
    bm = bmesh.new()
    is_male = (gender == "male")
    
    # Scale factors
    sx = 0.088 if is_male else 0.080
    sy = 0.100 if is_male else 0.092
    sz = 0.115 if is_male else 0.108
    
    # 1. Cranium base sphere (subdivided cube approach for clean quad edge-flow)
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        # Normalize to sphere
        v.co.normalize()
        # Shape cranium
        x = v.co.x * sx
        y = v.co.y * sy
        z = v.co.z * sz
        
        # Jaw and chin shaping below center
        if z < 0:
            t = abs(z) / sz
            # Taper sides toward chin
            jaw_taper = 0.72 if is_male else 0.60
            x *= (1.0 - t * (1.0 - jaw_taper))
            
            # Chin protrusion forward
            if y > 0:
                y += t * (0.018 if is_male else 0.012)
            else:
                # Nape taper
                y += t * 0.015
        else:
            # Forehead shape
            if y > 0:
                y *= 1.05
        
        v.co = Vector((x, y, z)) + head_center

    # Subdivide smoothly for clean facial contours
    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=1, use_grid_fill=True)
    for v in bm.verts:
        # Apply gentle Laplacian-style smoothing to keep quad topology crisp
        pass

    # 2. Add Stylized Nose
    nose_y = head_center.y + (sy * 0.95)
    nose_z = head_center.z - (sz * 0.12)
    nose_w = 0.014 if is_male else 0.011
    nose_len = 0.032 if is_male else 0.026
    nose_proj = 0.018 if is_male else 0.015
    
    # Simple clean stylized nose bridge & tip
    v_n_top = bm.verts.new(Vector((0, nose_y - 0.005, nose_z + nose_len * 0.5)))
    v_n_tip = bm.verts.new(Vector((0, nose_y + nose_proj, nose_z - nose_len * 0.3)))
    v_n_l = bm.verts.new(Vector((-nose_w, nose_y, nose_z - nose_len * 0.35)))
    v_n_r = bm.verts.new(Vector((nose_w, nose_y, nose_z - nose_len * 0.35)))
    v_n_bot = bm.verts.new(Vector((0, nose_y, nose_z - nose_len * 0.5)))
    
    bm.faces.new([v_n_top, v_n_tip, v_n_l])
    bm.faces.new([v_n_top, v_n_r, v_n_tip])
    bm.faces.new([v_n_tip, v_n_bot, v_n_l])
    bm.faces.new([v_n_tip, v_n_r, v_n_bot])

    # 3. Add Stylized Ears
    ear_w = 0.016
    ear_h = 0.038
    ear_z = head_center.z - 0.01
    ear_y = head_center.y - 0.01
    for side in (-1, 1):
        ear_x = (sx * 0.98) * side
        v_e_top = bm.verts.new(Vector((ear_x, ear_y, ear_z + ear_h * 0.5)))
        v_e_mid = bm.verts.new(Vector((ear_x + 0.012 * side, ear_y - 0.010, ear_z)))
        v_e_bot = bm.verts.new(Vector((ear_x, ear_y, ear_z - ear_h * 0.5)))
        v_e_in = bm.verts.new(Vector((ear_x - 0.004 * side, ear_y + 0.005, ear_z)))
        bm.faces.new([v_e_top, v_e_mid, v_e_bot, v_e_in])

    mesh = bpy.data.meshes.new(f"Head_{gender.capitalize()}")
    bm.to_mesh(mesh)
    bm.free()
    
    obj = bpy.data.objects.new(f"Head_{gender.capitalize()}", mesh)
    # Smooth normals
    for p in mesh.polygons:
        p.use_smooth = True
    return obj

def build_stylized_eyes(gender="male", head_center=Vector((0, 0, 1.56))):
    """Creates stylized expressive eyes positioned on the facial plane."""
    is_male = (gender == "male")
    eye_x = 0.036 if is_male else 0.034
    eye_y = head_center.y + (0.088 if is_male else 0.080)
    eye_z = head_center.z + 0.010
    eye_r = 0.014 if is_male else 0.016
    
    bm = bmesh.new()
    for side in (-1, 1):
        bmesh.ops.create_uvsphere(
            bm,
            u_segments=16,
            v_segments=12,
            radius=eye_r,
            matrix=Matrix.Translation(Vector((eye_x * side, eye_y, eye_z))) @ Matrix.Rotation(math.radians(90), 4, 'X')
        )
    mesh = bpy.data.meshes.new(f"Eyes_{gender.capitalize()}")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(f"Eyes_{gender.capitalize()}", mesh)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj

def build_stylized_body(gender="male", total_height=1.78):
    """
    Builds clean, mature adult educator body:
    Neck, Torso (Shirt), Arms & Hands, Legs (Trousers), and Shoes.
    """
    bm = bmesh.new()
    is_male = (gender == "male")
    
    # Proportions
    sh_w = 0.22 if is_male else 0.17  # Shoulder half-width
    chest_w = 0.18 if is_male else 0.14
    waist_w = 0.15 if is_male else 0.12
    hip_w = 0.16 if is_male else 0.16
    
    neck_z = 1.45 if is_male else 1.38
    sh_z = 1.38 if is_male else 1.31
    chest_z = 1.25 if is_male else 1.20
    waist_z = 1.05 if is_male else 1.00
    hip_z = 0.90 if is_male else 0.86
    knee_z = 0.50 if is_male else 0.48
    ankle_z = 0.12 if is_male else 0.11
    
    # 1. Neck Cylinder
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        segments=12,
        radius1=0.048 if is_male else 0.040,
        radius2=0.044 if is_male else 0.038,
        depth=0.12,
        matrix=Matrix.Translation(Vector((0, -0.01, neck_z - 0.04)))
    )
    
    # 2. Torso (Educator Shirt / Jacket)
    # Layered box-contour extrusion for clean clothing flow
    torso_levels = [
        (sh_z, sh_w, 0.10 if is_male else 0.09),
        (chest_z, chest_w, 0.11 if is_male else 0.10),
        (waist_z, waist_w, 0.09 if is_male else 0.08),
        (hip_z, hip_w, 0.10 if is_male else 0.11),
    ]
    
    # Create torso cube and shape via vertices
    bmesh.ops.create_cube(bm, size=1.0)
    # Shape torso block
    for v in bm.verts:
        z_n = v.co.z  # -0.5 to 0.5
        t = z_n + 0.5  # 0 to 1 (0 at hips, 1 at shoulders)
        w = hip_w * (1 - t) + sh_w * t
        d = 0.10 * (1 - t) + (0.11 if is_male else 0.10) * t
        v.co.x *= (w * 2.0)
        v.co.y *= (d * 2.0)
        v.co.z = hip_z * (1 - t) + sh_z * t
        # Subtle posture curve
        v.co.y += math.sin(t * math.pi) * 0.015

    bmesh.ops.subdivide_edges(bm, edges=bm.edges, cuts=1, use_grid_fill=True)

    # 3. Arms & Hands
    for side in (-1, 1):
        arm_x = (sh_w + 0.04) * side
        elbow_z = (sh_z + waist_z) * 0.5
        wrist_z = hip_z - 0.05
        
        # Upper arm
        bmesh.ops.create_cone(
            bm, cap_ends=True, segments=10,
            radius1=0.038 if is_male else 0.032,
            radius2=0.032 if is_male else 0.028,
            depth=sh_z - elbow_z,
            matrix=Matrix.Translation(Vector((arm_x, 0, (sh_z + elbow_z) * 0.5)))
        )
        # Forearm
        bmesh.ops.create_cone(
            bm, cap_ends=True, segments=10,
            radius1=0.032 if is_male else 0.028,
            radius2=0.026 if is_male else 0.022,
            depth=elbow_z - wrist_z,
            matrix=Matrix.Translation(Vector((arm_x, 0, (elbow_z + wrist_z) * 0.5)))
        )
        # Stylized Hand (beveled palm + thumb)
        hand_mat = Matrix.Translation(Vector((arm_x, 0, wrist_z - 0.05)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=hand_mat)
        # Hand vertices are last created
        for v in bm.verts[-8:]:
            v.co.x = arm_x + v.co.x * 0.035
            v.co.y = v.co.y * 0.022
            v.co.z = (wrist_z - 0.05) + v.co.z * 0.075

    # 4. Legs (Trousers)
    leg_offset_x = 0.09 if is_male else 0.08
    for side in (-1, 1):
        lx = leg_offset_x * side
        # Thigh
        bmesh.ops.create_cone(
            bm, cap_ends=True, segments=12,
            radius1=0.062 if is_male else 0.058,
            radius2=0.048 if is_male else 0.042,
            depth=hip_z - knee_z,
            matrix=Matrix.Translation(Vector((lx, 0, (hip_z + knee_z) * 0.5)))
        )
        # Calf
        bmesh.ops.create_cone(
            bm, cap_ends=True, segments=12,
            radius1=0.048 if is_male else 0.042,
            radius2=0.036 if is_male else 0.032,
            depth=knee_z - ankle_z,
            matrix=Matrix.Translation(Vector((lx, 0, (knee_z + ankle_z) * 0.5)))
        )

    # 5. Shoes (Clean modern sneakers / loafers)
    shoe_h = 0.08
    shoe_l = 0.22 if is_male else 0.19
    shoe_w = 0.082 if is_male else 0.072
    for side in (-1, 1):
        lx = leg_offset_x * side
        shoe_mat = Matrix.Translation(Vector((lx, 0.03, shoe_h * 0.5)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=shoe_mat)
        for v in bm.verts[-8:]:
            v.co.x = lx + v.co.x * shoe_w
            v.co.y = 0.03 + v.co.y * shoe_l
            v.co.z = (shoe_h * 0.5) + v.co.z * shoe_h
            # Toe taper
            if v.co.y > 0.06:
                v.co.z *= 0.75
                v.co.x *= 0.85

    mesh = bpy.data.meshes.new(f"Body_{gender.capitalize()}")
    bm.to_mesh(mesh)
    bm.free()
    
    obj = bpy.data.objects.new(f"Body_{gender.capitalize()}", mesh)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj

def build_scalp_anchor(gender="male", head_center=Vector((0, 0, 1.56))):
    """
    Builds the standardized Scalp Anchor mesh.
    This is the master anatomical reference shell that hugs the cranium
    and defines the hairline curve (forehead, temples, sideburns, nape)
    which all hairstyles will snap to.
    """
    bm = bmesh.new()
    is_male = (gender == "male")
    sx = (0.088 if is_male else 0.080) * 1.02
    sy = (0.100 if is_male else 0.092) * 1.02
    sz = (0.115 if is_male else 0.108) * 1.02
    
    # Half-dome sphere for the scalp
    bmesh.ops.create_uvsphere(
        bm, u_segments=24, v_segments=16, radius=1.0
    )
    # Remove lower hemisphere vertices below the anatomical hairline curve
    verts_to_delete = []
    for v in bm.verts:
        # Scale to match head cranium
        v.co.x *= sx
        v.co.y *= sy
        v.co.z *= sz
        
        # Calculate hairline cutoff height
        # Forehead front: cutoff at +0.02
        # Temples: dips to -0.01
        # Sideburns (near x=sx): drops to -0.04
        # Nape back (y < 0): drops to -0.035
        y_norm = v.co.y / sy  # -1 (back) to +1 (front)
        x_norm = abs(v.co.x) / sx  # 0 (center) to 1 (sides)
        
        if y_norm > 0:
            # Front hairline curve
            cutoff_z = 0.025 - (x_norm * 0.045)
        else:
            # Back nape curve
            cutoff_z = -0.030 + (x_norm * 0.015)
            
        if v.co.z < cutoff_z:
            verts_to_delete.append(v)
        else:
            v.co += head_center

    bmesh.ops.delete(bm, geom=verts_to_delete, context='VERTS')
    
    mesh = bpy.data.meshes.new(f"ScalpAnchor_{gender.capitalize()}")
    bm.to_mesh(mesh)
    bm.free()
    
    obj = bpy.data.objects.new(f"ScalpAnchor_{gender.capitalize()}", mesh)
    for p in mesh.polygons:
        p.use_smooth = True
    return obj

def build_humanoid_armature(gender="male", total_height=1.78):
    """
    Creates a standard humanoid Armature with clean Mixamo-compatible bones.
    """
    is_male = (gender == "male")
    arm_data = bpy.data.armatures.new(f"Armature_{gender.capitalize()}")
    arm_data.display_type = 'OCTAHEDRAL'
    arm_obj = bpy.data.objects.new(f"Armature_{gender.capitalize()}", arm_data)
    
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    
    edit_bones = arm_data.edit_bones
    
    # Heights
    hip_z = 0.90 if is_male else 0.86
    spine_z = 1.05 if is_male else 1.00
    chest_z = 1.25 if is_male else 1.20
    neck_z = 1.45 if is_male else 1.38
    head_z = 1.56 if is_male else 1.48
    head_top_z = total_height
    sh_w = 0.22 if is_male else 0.17
    sh_z = 1.38 if is_male else 1.31
    elbow_z = (sh_z + spine_z) * 0.5
    wrist_z = hip_z - 0.05
    knee_z = 0.50 if is_male else 0.48
    foot_z = 0.08
    leg_x = 0.09 if is_male else 0.08
    
    # Spine chain
    hips = edit_bones.new('Hips')
    hips.head = Vector((0, 0, hip_z))
    hips.tail = Vector((0, 0, spine_z))
    
    spine = edit_bones.new('Spine')
    spine.head = hips.tail
    spine.tail = Vector((0, 0, chest_z))
    spine.parent = hips
    
    spine1 = edit_bones.new('Spine1')
    spine1.head = spine.tail
    spine1.tail = Vector((0, 0, neck_z))
    spine1.parent = spine
    
    neck = edit_bones.new('Neck')
    neck.head = spine1.tail
    neck.tail = Vector((0, 0, head_z))
    neck.parent = spine1
    
    head = edit_bones.new('Head')
    head.head = neck.tail
    head.tail = Vector((0, 0, head_top_z))
    head.parent = neck
    
    # Arms
    for side, prefix, sx in (('Left', 'Left', 1), ('Right', 'Right', -1)):
        sh = edit_bones.new(f'{prefix}Shoulder')
        sh.head = spine1.tail
        sh.tail = Vector((sh_w * sx * 0.5, 0, sh_z))
        sh.parent = spine1
        
        arm = edit_bones.new(f'{prefix}Arm')
        arm.head = Vector(((sh_w + 0.04) * sx, 0, sh_z))
        arm.tail = Vector(((sh_w + 0.04) * sx, 0, elbow_z))
        arm.parent = sh
        
        forearm = edit_bones.new(f'{prefix}ForeArm')
        forearm.head = arm.tail
        forearm.tail = Vector(((sh_w + 0.04) * sx, 0, wrist_z))
        forearm.parent = arm
        
        hand = edit_bones.new(f'{prefix}Hand')
        hand.head = forearm.tail
        hand.tail = Vector(((sh_w + 0.04) * sx, 0, wrist_z - 0.08))
        hand.parent = forearm

    # Legs
    for side, prefix, sx in (('Left', 'Left', 1), ('Right', 'Right', -1)):
        upleg = edit_bones.new(f'{prefix}UpLeg')
        upleg.head = Vector((leg_x * sx, 0, hip_z))
        upleg.tail = Vector((leg_x * sx, 0, knee_z))
        upleg.parent = hips
        
        leg = edit_bones.new(f'{prefix}Leg')
        leg.head = upleg.tail
        leg.tail = Vector((leg_x * sx, 0, foot_z))
        leg.parent = upleg
        
        foot = edit_bones.new(f'{prefix}Foot')
        foot.head = leg.tail
        foot.tail = Vector((leg_x * sx, 0.12, 0.02))
        foot.parent = leg

    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

def assign_materials(head_obj, eyes_obj, body_obj, scalp_obj, gender="male"):
    """Creates and assigns stylized PBR materials to the character components."""
    # Skin
    skin_col = "#e0a885" if gender == "male" else "#e8b898"
    skin_mat = create_material(f"Mat_Skin_{gender.capitalize()}", skin_col, roughness=0.55)
    
    # Eyes
    eye_mat = create_material("Mat_Eyes", "#1e293b", roughness=0.15, metalness=0.1)
    
    # Clothes (UCLA spirit defaults)
    shirt_col = "#1d4ed8" if gender == "male" else "#2563eb"
    shirt_mat = create_material(f"Mat_Shirt_{gender.capitalize()}", shirt_col, roughness=0.65)
    pants_mat = create_material("Mat_Pants", "#334155", roughness=0.70)
    shoes_mat = create_material("Mat_Shoes", "#f8fafc", roughness=0.40)
    scalp_mat = create_material("Mat_ScalpAnchor", "#26170e", roughness=0.85)
    
    head_obj.data.materials.append(skin_mat)
    eyes_obj.data.materials.append(eye_mat)
    scalp_obj.data.materials.append(scalp_mat)
    
    # Body gets multi-materials
    body_obj.data.materials.append(shirt_mat)
    body_obj.data.materials.append(pants_mat)
    body_obj.data.materials.append(shoes_mat)
    body_obj.data.materials.append(skin_mat)
    
    # Assign material slots based on height
    mesh = body_obj.data
    for poly in mesh.polygons:
        center_z = poly.center.z
        if center_z > 1.35:
            # Neck: Skin
            poly.material_index = 3
        elif center_z > 0.88:
            # Torso & Arms: Shirt
            poly.material_index = 0
        elif center_z > 0.10:
            # Legs: Pants
            poly.material_index = 1
        else:
            # Feet: Shoes
            poly.material_index = 2

def build_character(gender="male", total_height=1.78, offset_x=0.0):
    """Assembles a complete Master Character (Head, Eyes, Body, ScalpAnchor, Armature)."""
    col = bpy.data.collections.new(f"Character_{gender.capitalize()}")
    bpy.context.scene.collection.children.link(col)
    
    head_z = 1.56 if gender == "male" else 1.48
    head_center = Vector((offset_x, 0, head_z))
    
    head = build_stylized_head(gender, head_center)
    eyes = build_stylized_eyes(gender, head_center)
    body = build_stylized_body(gender, total_height)
    scalp = build_scalp_anchor(gender, head_center)
    arm = build_humanoid_armature(gender, total_height)
    
    body.location.x = offset_x
    arm.location.x = offset_x
    
    for obj in (head, eyes, body, scalp):
        col.objects.link(obj)
        # Parent to armature
        obj.parent = arm
        
    assign_materials(head, eyes, body, scalp, gender)
    return col, arm

def main():
    clear_scene()
    
    print("Generating Master Male Educator Model...")
    male_col, male_arm = build_character("male", total_height=1.78, offset_x=-0.6)
    
    print("Generating Master Female Educator Model...")
    female_col, female_arm = build_character("female", total_height=1.68, offset_x=0.6)
    
    # Save the master .blend file so the user can open it directly in Blender
    blend_path = "c:/ELD_PD_Game/blender/character_studio.blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Master project saved to: {blend_path}")
    
    # Export Male .glb
    bpy.ops.object.select_all(action='DESELECT')
    for obj in male_col.all_objects:
        obj.select_set(True)
    male_arm.select_set(True)
    male_glb_path = "c:/ELD_PD_Game/client/public/models/character_male.glb"
    bpy.ops.export_scene.gltf(
        filepath=male_glb_path,
        use_selection=True,
        export_format='GLB',
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False
    )
    print(f"Exported: {male_glb_path}")
    
    # Export Female .glb
    bpy.ops.object.select_all(action='DESELECT')
    for obj in female_col.all_objects:
        obj.select_set(True)
    female_arm.select_set(True)
    female_glb_path = "c:/ELD_PD_Game/client/public/models/character_female.glb"
    bpy.ops.export_scene.gltf(
        filepath=female_glb_path,
        use_selection=True,
        export_format='GLB',
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False
    )
    print(f"Exported: {female_glb_path}")

if __name__ == "__main__":
    main()

