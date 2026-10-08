# Anatomy data attribution

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- License: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27)
- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- License terms: https://creativecommons.org/licenses/by/4.0/
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0.
- English names and relationships: IS-A and PART-OF concept, element, and inclusion tables from the same archive.
- Publication: Mitsuhashi et al. (2009), BodyParts3D: 3D structure database for anatomical concepts. https://doi.org/10.1093/nar/gkn613

Adaptations: axes and units converted from millimeters/Z-up to meters/Y-up; translated to rest at the stage; geometry simplified using meshoptimizer with 0.2% relative error limit per structure; normals quantized to signed 16-bit; packed into binary chunks; curated display system groupings and colors. The source contains 2,234 individual OBJ meshes; all remain represented. The combined hierarchy contains 3,432 named FMA concepts, which may reference multiple meshes. Original source identity is preserved in the manifest.

Source OBJ comments mention an older CC BY-SA 2.1 Japan license. The official current database license linked above supersedes that legacy text and explicitly permits redistribution and adaptation under CC BY 4.0.

BodyParts3D represents an adult male reference anatomy based on TARO MRI and anatomical illustration refinements. It is not a complete model of every possible human anatomical structure or variation. This interface is educational and is not a clinical tool.

## Female reference anatomy

The selectable female atlas integrates Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female v1.5* (2023), with BodyParts3D structures and morphological adaptations by Mahendra Beniwal. The anatomical datasets are CC BY 4.0; the imported viewer source is MIT licensed.

- Source DOI: https://doi.org/10.48539/HBM352.BTSQ.586
- Dataset: https://lod.humanatlas.io/ref-organ/united-female/v1.5
- Original GLB: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/assets/3d-vh-f-united.glb
- License: https://creativecommons.org/licenses/by/4.0/

Adaptations: coincident vertices welded and source normals averaged; geometry simplified with a 0.2% per-structure relative error bound; normals quantized; full BodyParts3D musculoskeletal and peripheral vascular structures integrated with HuBMAP female visceral anatomy; female morphological proportions applied across compatible layers. The HRA knee soft-tissue and renal assemblies were aligned to the composite body, and two duplicate BodyParts3D kidney shells were removed. Colors and display systems are curated for this interface. The selectable atlas contains 3,002 meshes across 16 systems.

This is an educational reference assembly, not a single-person scan or a clinical tool. It includes female reproductive anatomy, mammary structures, and eight placenta/umbilical reference structures grouped under Pregnancy reference.

The complete imported attribution and software-license texts are preserved as `FEMALE_ATTRIBUTION.md` and `FEMALE_LICENSE.txt` in this directory.
