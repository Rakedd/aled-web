/**
 * @jest-environment node
 */
import {
  assignEndClientParent,
  findContactDetails,
  saveContactDetails,
  saveIntermediaryKind,
  searchEntitySuggestions,
} from "@/server/repositories/entities-repository";
import { createServerSupabaseClient } from "@/server/supabase/create-server-supabase-client";
import { getAuthenticatedUser } from "@/server/supabase/get-authenticated-user";
import {
  getContactDetails,
  searchEntities,
  setEndClientParent,
  updateContactDetails,
  updateIntermediaryKind,
} from "./entity-actions";

jest.mock("server-only", () => ({}));
jest.mock("@/server/supabase/get-authenticated-user", () => ({
  getAuthenticatedUser: jest.fn(),
}));
jest.mock("@/server/supabase/create-server-supabase-client", () => ({
  createServerSupabaseClient: jest.fn(),
}));
jest.mock("@/server/repositories/entities-repository", () => ({
  searchEntitySuggestions: jest.fn(),
  assignEndClientParent: jest.fn(),
  findContactDetails: jest.fn(),
  saveContactDetails: jest.fn(),
  saveIntermediaryKind: jest.fn(),
}));

const fakeSupabaseClient = { from: jest.fn() } as unknown as Awaited<
  ReturnType<typeof createServerSupabaseClient>
>;
const subsidiaryId = "6f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f";
const groupId = "7a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const succeeded = { ok: true, data: null } as const;

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getAuthenticatedUser)
    .mockResolvedValue({ id: "user-1", email: "ada@example.com" });
  jest.mocked(createServerSupabaseClient).mockResolvedValue(fakeSupabaseClient);
});

describe("searchEntities", () => {
  it("searches the entities of the authenticated user", async () => {
    jest
      .mocked(searchEntitySuggestions)
      .mockResolvedValue([
        {
          id: subsidiaryId,
          name: "BNP Paribas AM",
          label: "BNP Paribas AM (BNP Paribas)",
          parentName: "BNP Paribas",
          contactDetails: null,
        },
      ]);
    await expect(searchEntities("end_client", "bnp")).resolves.toEqual({
      ok: true,
      data: [
        {
          id: subsidiaryId,
          name: "BNP Paribas AM",
          label: "BNP Paribas AM (BNP Paribas)",
          parentName: "BNP Paribas",
          contactDetails: null,
        },
      ],
    });
    expect(searchEntitySuggestions).toHaveBeenCalledWith(
      fakeSupabaseClient,
      "user-1",
      {
        entityKind: "end_client",
        query: "bnp",
      },
    );
  });

  it("rejects an unknown entity kind", async () => {
    const unknownEntityKind = "profiles" as Parameters<
      typeof searchEntities
    >[0];
    await expect(searchEntities(unknownEntityKind, "bnp")).resolves.toEqual({
      ok: false,
      errorMessage: "Recherche invalide",
    });
    expect(searchEntitySuggestions).not.toHaveBeenCalled();
  });
});

describe("setEndClientParent", () => {
  it("assigns the parent group", async () => {
    jest.mocked(assignEndClientParent).mockResolvedValue(succeeded);
    await expect(setEndClientParent(subsidiaryId, groupId)).resolves.toEqual(
      succeeded,
    );
    expect(assignEndClientParent).toHaveBeenCalledWith(
      fakeSupabaseClient,
      "user-1",
      subsidiaryId,
      groupId,
    );
  });

  it("removes the parent group", async () => {
    jest.mocked(assignEndClientParent).mockResolvedValue(succeeded);
    await setEndClientParent(subsidiaryId, null);
    expect(assignEndClientParent).toHaveBeenCalledWith(
      fakeSupabaseClient,
      "user-1",
      subsidiaryId,
      null,
    );
  });

  it("rejects a malformed parent id", async () => {
    await expect(setEndClientParent(subsidiaryId, "groupe")).resolves.toEqual({
      ok: false,
      errorMessage: "Client final introuvable",
    });
    expect(assignEndClientParent).not.toHaveBeenCalled();
  });
});

describe("getContactDetails", () => {
  it("reads the contact of the authenticated user", async () => {
    jest
      .mocked(findContactDetails)
      .mockResolvedValue({ ok: false, errorMessage: "Contact introuvable" });
    await getContactDetails(subsidiaryId);
    expect(findContactDetails).toHaveBeenCalledWith(
      fakeSupabaseClient,
      "user-1",
      subsidiaryId,
    );
  });

  it("rejects a malformed contact id", async () => {
    await expect(getContactDetails("jean")).resolves.toEqual({
      ok: false,
      errorMessage: "Contact introuvable",
    });
    expect(findContactDetails).not.toHaveBeenCalled();
  });
});

describe("updateContactDetails", () => {
  it("saves the validated details", async () => {
    jest.mocked(saveContactDetails).mockResolvedValue(succeeded);
    await expect(
      updateContactDetails(subsidiaryId, {
        fullName: " Jean ",
        phone: "",
        email: null,
        linkedinUrl: null,
      }),
    ).resolves.toEqual(succeeded);
    expect(saveContactDetails).toHaveBeenCalledWith(
      fakeSupabaseClient,
      "user-1",
      subsidiaryId,
      {
        fullName: "Jean",
        phone: null,
        email: null,
        linkedinUrl: null,
      },
    );
  });

  it("rejects a malformed e-mail", async () => {
    await expect(
      updateContactDetails(subsidiaryId, {
        fullName: "Jean",
        phone: null,
        email: "jean@",
        linkedinUrl: null,
      }),
    ).resolves.toEqual({ ok: false, errorMessage: "E-mail invalide" });
    expect(saveContactDetails).not.toHaveBeenCalled();
  });
});

describe("updateIntermediaryKind", () => {
  it("saves a known kind", async () => {
    jest.mocked(saveIntermediaryKind).mockResolvedValue(succeeded);
    await expect(
      updateIntermediaryKind(subsidiaryId, "platform"),
    ).resolves.toEqual(succeeded);
    expect(saveIntermediaryKind).toHaveBeenCalledWith(
      fakeSupabaseClient,
      "user-1",
      subsidiaryId,
      "platform",
    );
  });

  it("rejects an unknown kind", async () => {
    const unknownIntermediaryKind = "bank" as Parameters<
      typeof updateIntermediaryKind
    >[1];
    await expect(
      updateIntermediaryKind(subsidiaryId, unknownIntermediaryKind),
    ).resolves.toEqual({
      ok: false,
      errorMessage: "Type d'intermédiaire invalide",
    });
    expect(saveIntermediaryKind).not.toHaveBeenCalled();
  });
});
