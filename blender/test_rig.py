import bpy
from mathutils import Vector

blend_path = r"c:\ELD_PD_Game\blender\blender_studio_stylized_characters.blend"
bpy.ops.wm.open_mainfile(filepath=blend_path)

def create_humanoid_armature(name, height, is_male=True):
    arm_data = bpy.data.armatures.new(name)
    arm_obj = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    
    eb = arm_data.edit_bones
    
    # Scale proportional to height (1.80m male, 1.62m female)
    scale = height / 1.80
    
    hip_z = 0.94 * scale
    spine_z = 1.08 * scale
    chest_z = 1.28 * scale
    neck_z = 1.48 * scale
    head_z = 1.60 * scale
    head_top = height
    
    sh_w = (0.19 if is_male else 0.15) * scale
    sh_z = 1.42 * scale
    elbow_z = 1.15 * scale
    wrist_z = 0.88 * scale
    hand_z = 0.78 * scale
    arm_x = (0.34 if is_male else 0.28) * scale
    wrist_x = (0.42 if is_male else 0.35) * scale
    
    leg_x = (0.11 if is_male else 0.10) * scale
    knee_z = 0.52 * scale
    foot_z = 0.08 * scale
    
    # Hips
    hips = eb.new('Hips')
    hips.head = Vector((0, 0, hip_z))
    hips.tail = Vector((0, 0, spine_z))
    
    # Spine
    spine = eb.new('Spine')
    spine.head = hips.tail
    spine.tail = Vector((0, 0, chest_z))
    spine.parent = hips
    
    spine1 = eb.new('Spine1')
    spine1.head = spine.tail
    spine1.tail = Vector((0, 0, neck_z))
    spine1.parent = spine
    
    neck = eb.new('Neck')
    neck.head = spine1.tail
    neck.tail = Vector((0, 0, head_z))
    neck.parent = spine1
    
    head = eb.new('Head')
    head.head = neck.tail
    head.tail = Vector((0, 0, head_top))
    head.parent = neck
    
    # Arms
    for side, prefix, sx in (('Left', 'Left', 1), ('Right', 'Right', -1)):
        sh = eb.new(f'{prefix}Shoulder')
        sh.head = Vector((0, 0, neck_z))
        sh.tail = Vector((sh_w * sx, 0, sh_z))
        sh.parent = spine1
        
        arm = eb.new(f'{prefix}Arm')
        arm.head = sh.tail
        arm.tail = Vector((arm_x * sx, -0.02 * scale, elbow_z))
        arm.parent = sh
        
        forearm = eb.new(f'{prefix}ForeArm')
        forearm.head = arm.tail
        forearm.tail = Vector((wrist_x * sx, 0.02 * scale, wrist_z))
        forearm.parent = arm
        
        hand = eb.new(f'{prefix}Hand')
        hand.head = forearm.tail
        hand.tail = Vector(((wrist_x + 0.05) * sx, 0.03 * scale, hand_z))
        hand.parent = forearm

    # Legs
    for side, prefix, sx in (('Left', 'Left', 1), ('Right', 'Right', -1)):
        upleg = eb.new(f'{prefix}UpLeg')
        upleg.head = Vector((leg_x * sx, 0, hip_z))
        upleg.tail = Vector((leg_x * sx, 0.01 * scale, knee_z))
        upleg.parent = hips
        
        leg = eb.new(f'{prefix}Leg')
        leg.head = upleg.tail
        leg.tail = Vector((leg_x * sx, -0.01 * scale, foot_z))
        leg.parent = upleg
        
        foot = eb.new(f'{prefix}Foot')
        foot.head = leg.tail
        foot.tail = Vector((leg_x * sx, 0.14 * scale, 0.02))
        foot.parent = leg
        
        toe = eb.new(f'{prefix}ToeBase')
        toe.head = foot.tail
        toe.tail = Vector((leg_x * sx, 0.20 * scale, 0.02))
        toe.parent = foot
        
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm_obj

male_mesh = bpy.data.objects.get("GEO-body_male_stylized")
if male_mesh:
    # Reset location to origin for rigging
    male_mesh.location = Vector((0, 0, 0))
    male_arm = create_humanoid_armature("Armature_Male", 1.80, is_male=True)
    male_arm.location = Vector((0, 0, 0))
    
    # Join eyes into body or parent them
    eyes_l = bpy.data.objects.get("GEO-body_male_stylized.eye.L")
    eyes_r = bpy.data.objects.get("GEO-body_male_stylized.eye.R")
    if eyes_l: eyes_l.location.x = 0
    if eyes_r: eyes_r.location.x = 0
    
    # Auto-weight parent
    bpy.ops.object.select_all(action='DESELECT')
    male_mesh.select_set(True)
    if eyes_l: eyes_l.select_set(True)
    if eyes_r: eyes_r.select_set(True)
    male_arm.select_set(True)
    bpy.context.view_layer.objects.active = male_arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    print("MALE RIGGED: vertex groups =", len(male_mesh.vertex_groups))

female_mesh = bpy.data.objects.get("GEO-body_female_stylized")
if female_mesh:
    female_mesh.location = Vector((0, 0, 0))
    female_arm = create_humanoid_armature("Armature_Female", 1.62, is_male=False)
    female_arm.location = Vector((0, 0, 0))
    
    eyes_fl = bpy.data.objects.get("GEO-body_female_stylized.eye.L")
    eyes_fr = bpy.data.objects.get("GEO-body_female_stylized.eye.R")
    if eyes_fl: eyes_fl.location.x = 0
    if eyes_fr: eyes_fr.location.x = 0
    
    bpy.ops.object.select_all(action='DESELECT')
    female_mesh.select_set(True)
    if eyes_fl: eyes_fl.select_set(True)
    if eyes_fr: eyes_fr.select_set(True)
    female_arm.select_set(True)
    bpy.context.view_layer.objects.active = female_arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    print("FEMALE RIGGED: vertex groups =", len(female_mesh.vertex_groups))

