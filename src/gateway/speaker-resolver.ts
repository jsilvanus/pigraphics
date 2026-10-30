/**
 * Speaker & Role resolution for live broadcast graphics.
 *
 * Rules:
 * 1. Names are NEVER inferred from transcription alone.
 * 2. Rundown defines roles, names, and titles (e.g. preacher, liturgist, cantor, reader).
 * 3. Multiple priests/speakers can exist in one service.
 * 4. IF NAMES ARE NOT PRESENT, ONLY ROLE CAN BE DISPLAYED.
 */

export interface SpeakerStrapData {
  /** The main line (person's name if known; or the role if name is absent) */
  speaker: string;
  /** The subtitle / role line (role/title if name is known; empty or parish if role is in main line) */
  title: string;
  /** Explicit role, e.g. "Liturgi", "Saarnaaja", "Kanttori", "Tekstinlukija" */
  role: string;
  /** True when name is present; false when only role can be displayed */
  hasName: boolean;
}

export interface ResolveSpeakerParams {
  role?: string | undefined;
  name?: string | undefined;
  title?: string | undefined;
  defaultParish?: string | undefined;
}

/**
 * Formats speaker strap bindings adhering strictly to the invariant:
 * If name is absent, ONLY role is displayed as the primary strap text.
 */
export function formatSpeakerStrap(params: ResolveSpeakerParams): SpeakerStrapData {
  const defaultParish = params.defaultParish || "Riihimäen Keskuskirkko";
  const name = params.name?.trim();
  const role = params.role?.trim() || "Liturgi";
  const title = params.title?.trim();

  if (name && name.length > 0) {
    // Both name and role/title are present
    return {
      speaker: name,
      title: title || role,
      role,
      hasName: true,
    };
  }

  // Name is not present -> ONLY role can be displayed!
  return {
    speaker: role,
    title: title && title !== role ? title : defaultParish,
    role,
    hasName: false,
  };
}

export interface RundownItemContext {
  id?: string | undefined;
  title?: string | undefined;
  section?: string | undefined;
}

/**
 * Determines the active role and resolves speaker bindings from the rundown status snapshot.
 */
export function resolveSpeakerFromRundown(
  item: RundownItemContext | null,
  variables: Record<string, unknown> = {}
): SpeakerStrapData | null {
  if (!item && Object.keys(variables).length === 0) return null;

  const id = (item?.id || "").toLowerCase();
  const section = (item?.section || "").toLowerCase();
  const title = (item?.title || "").toLowerCase();

  const getVar = (key: string): string | undefined => {
    const val = variables[key];
    return typeof val === "string" && val.trim().length > 0 ? val.trim() : undefined;
  };

  // Check explicit variables first
  const explicitRole = getVar("role") || getVar("speaker_role") || getVar("current_role");
  const explicitName = getVar("speaker") || getVar("speaker_name");
  const explicitTitle = getVar("title") || getVar("speaker_title");

  if (explicitRole || explicitName) {
    return formatSpeakerStrap({
      role: explicitRole,
      name: explicitName,
      title: explicitTitle,
    });
  }

  // Infer liturgical role based on rundown item / section
  if (id.includes("saarna") || section.includes("sana") || title.includes("saarna")) {
    const name = getVar("preacher") || getVar("saarnaaja");
    const roleTitle = getVar("preacher_title") || "Saarnaaja";
    return formatSpeakerStrap({
      role: "Saarnaaja",
      name,
      title: roleTitle,
    });
  }

  if (
    id.includes("siunaus") ||
    id.includes("ehtoollinen") ||
    id.includes("rukous") ||
    section.includes("johdanto") ||
    section.includes("päätös")
  ) {
    const name = getVar("liturgist") || getVar("liturgi");
    const roleTitle = getVar("liturgist_title") || "Liturgi";
    return formatSpeakerStrap({
      role: "Liturgi",
      name,
      title: roleTitle,
    });
  }

  if (id.includes("virsi") || id.includes("soitto") || section.includes("ylistys")) {
    const name = getVar("cantor") || getVar("kanttori");
    const roleTitle = getVar("cantor_title") || "Kanttori";
    return formatSpeakerStrap({
      role: "Kanttori",
      name,
      title: roleTitle,
    });
  }

  if (id.includes("evankeliumi") || id.includes("lukukappale") || title.includes("lukukappale")) {
    const name = getVar("reader") || getVar("tekstinlukija") || getVar("lukija");
    const roleTitle = getVar("reader_title") || "Tekstinlukija";
    return formatSpeakerStrap({
      role: "Tekstinlukija",
      name,
      title: roleTitle,
    });
  }

  return null;
}
