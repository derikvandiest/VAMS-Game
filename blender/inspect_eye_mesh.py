import bpy

source_blend = r"c:\ELD_PD_Game\blender\human_base_meshes\human-base-meshes-bundle-v1.4.1\human_base_meshes_bundle.blend"
bpy.ops.wm.open_mainfile(filepath=source_blend)

eye = bpy.data.objects.get("GEO-body_male_stylized.eye.L")
if eye:
    verts = [v.co for v in eye.data.vertices]
    min_x, max_x = min(v.x for v in verts), max(v.x for v in verts)
    min_y, max_y = min(v.y for v in verts), max(v.y for v in verts)
    min_z, max_z = min(v.z for v in verts), max(v.z for v in verts)
    print("Eye Local Extents:")
    print(f"  X: {min_x:.4f} to {max_x:.4f} (width: {max_x - min_x:.4f})")
    print(f"  Y: {min_y:.4f} to {max_y:.4f} (depth: {max_y - min_y:.4f})")
    print(f"  Z: {min_z:.4f} to {max_z:.4f} (height: {max_z - min_z:.4f})")
    
    # Check polygon centers relative to front pole
    # The front of the eye is in the -Y direction (or +Y?)
    front_polys = [p for p in eye.data.polygons if p.center.y < -0.015]
    print(f"Total polygons: {len(eye.data.polygons)}, Front polygons: {len(front_polys)}")
    
    # Group polygons by radius from center on front face
    center_y = min(p.center.y for p in eye.data.polygons)
    print("Front-most Y:", center_y)

