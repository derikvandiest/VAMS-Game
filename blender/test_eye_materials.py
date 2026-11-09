import bpy
from mathutils import Vector
import math

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
bpy.ops.wm.open_mainfile(filepath=source_blend)

def create_pbr_material(name, hex_color, roughness=0.2, metalness=0.0):
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
            bsdf.inputs["Metallic"].default_value = metalness
    return mat

mat_sclera = create_pbr_material("Mat_Eye_Sclera", "#f8fafc", roughness=0.15)
mat_iris = create_pbr_material("Mat_Eye_Iris", "#2563eb", roughness=0.10)
mat_pupil = create_pbr_material("Mat_Eye_Pupil", "#09090b", roughness=0.05)

def style_eye_mesh(eye_obj):
    eye_obj.data.materials.clear()
    eye_obj.data.materials.append(mat_sclera)  # 0
    eye_obj.data.materials.append(mat_iris)    # 1
    eye_obj.data.materials.append(mat_pupil)   # 2
    
    pupil_count = 0
    iris_count = 0
    sclera_count = 0
    
    for poly in eye_obj.data.polygons:
        # local coords of polygon center
        c = poly.center
        r = math.hypot(c.x, c.z)
        
        # Front of eyeball is y < -0.010
        if c.y < -0.015:
            if r < 0.009:
                poly.material_index = 2  # Pupil
                pupil_count += 1
            elif r < 0.021:
                poly.material_index = 1  # Iris
                iris_count += 1
            else:
                poly.material_index = 0  # Sclera
                sclera_count += 1
        else:
            poly.material_index = 0  # Sclera
            sclera_count += 1
            
    print(f"Eyeball {eye_obj.name}: Pupil={pupil_count}, Iris={iris_count}, Sclera={sclera_count}")

style_eye_mesh(bpy.data.objects.get("GEO-body_male_stylized.eye.L"))
style_eye_mesh(bpy.data.objects.get("GEO-body_male_stylized.eye.R"))

