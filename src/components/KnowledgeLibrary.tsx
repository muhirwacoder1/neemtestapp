import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import { BookOpen, Upload, Trash2 } from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import { useStore } from "../store";
import { Button, Card, Empty, Input, T, Badge, useTheme } from "./ui";
import { useNavigation } from "../navigation";
export function KnowledgeLibrary() {
  const { guest } = useStore(),
    nav = useNavigation();
  return guest ? (
    <>
      <T>Sign in to browse the books and guides used by Neem AI.</T>
      <Button label="Sign in" onPress={() => nav.open({ kind: "auth" })} />
    </>
  ) : (
    <Library />
  );
}
function Library() {
  const c = useTheme(),
    { setNotice } = useStore(),
    docs = useQuery(api.library.list, {}),
    permissions = useQuery(api.library.permissions, {}),
    config = useQuery(api.ai.configuration, {}),
    uploadUrl = useMutation(api.library.uploadUrl),
    create = useMutation(api.library.create),
    retry = useMutation(api.library.retry),
    remove = useMutation(api.library.remove);
  const [title, setTitle] = useState(""),
    [author, setAuthor] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState("");
  async function upload() {
    if (!title.trim()) {
      setNotice("Enter the book or guide title first.");
      return;
    }
    setBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/plain", "text/markdown"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if ((asset.size || 0) > 8 * 1024 * 1024)
        throw new Error("Choose a file up to 8 MB.");
      const url = await uploadUrl({}),
        type = asset.mimeType || "application/octet-stream";
      const body =
        Platform.OS === "web"
          ? asset.file || (await (await fetch(asset.uri)).blob())
          : new File(asset.uri);
      const response = await expoFetch(url, {
        method: "POST",
        headers: { "Content-Type": type },
        body,
      });
      if (!response.ok) throw new Error("Your file could not be uploaded.");
      const { storageId } = await response.json();
      await create({
        storageId,
        title: title.trim(),
        author: author.trim(),
        fileName: asset.name,
        contentType: type,
      });
      setTitle("");
      setAuthor("");
      setNotice(
        "Your book is processing. You can leave this page while it finishes.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "This book could not be uploaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {permissions?.admin && config?.libraryConnected && (
        <Card style={{ gap: 15, backgroundColor: c.pale }}>
          <T size={18} weight="bold">
            Add a book or guide
          </T>
          <Input
            label="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={160}
          />
          <Input
            label="Author or source"
            value={author}
            onChangeText={setAuthor}
            maxLength={120}
          />
          <Button
            icon={Upload}
            label="Choose PDF, TXT or Markdown"
            loading={busy}
            onPress={upload}
          />
          <T size={11} color={c.muted}>
            Up to 8 MB. Add material you have permission to use. Scanned PDFs
            need readable text.
          </T>
        </Card>
      )}
      <T size={13} color={c.muted}>
        {config?.libraryConnected
          ? "Neem AI searches ready books for relevant passages and cites their title and PDF page. New uploads become available after processing completes."
          : "Book search is not connected yet. Saved books remain in your library, and Neem’s articles are available in Education."}
      </T>
      {docs?.length ? (
        docs.map((d) => (
          <Card key={d.id} style={{ gap: 9 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              <BookOpen size={21} color={c.teal} />
              <T size={16} weight="bold" style={{ flex: 1 }}>
                {d.title}
              </T>
              <Badge
                label={
                  d.state === "ready"
                    ? "Ready"
                    : d.state === "failed"
                      ? "Needs attention"
                      : "Processing"
                }
              />
            </View>
            <T size={12} color={c.muted}>
              {d.author || "Neem library"} · {d.indexedChunks} of{" "}
              {d.totalChunks} passages indexed
            </T>
            {!!d.error && (
              <T size={12} color={c.danger}>
                {d.error}
              </T>
            )}
            {permissions?.admin && (
              <View style={{ flexDirection: "row", gap: 9 }}>
                {d.state === "failed" && config?.libraryConnected && (
                  <Button
                    label="Resume processing"
                    small
                    secondary
                    onPress={() =>
                      retry({ id: d.id }).catch(() =>
                        setNotice("This book could not be retried."),
                      )
                    }
                  />
                )}
                <Button
                  label={confirmDelete === d.id ? "Confirm removal" : "Remove"}
                  icon={Trash2}
                  small
                  secondary
                  onPress={async () => {
                    if (confirmDelete !== d.id) {
                      setConfirmDelete(d.id);
                      return;
                    }
                    try {
                      await remove({ id: d.id });
                      setConfirmDelete("");
                    } catch {
                      setNotice("This book could not be removed.");
                    }
                  }}
                />
              </View>
            )}
          </Card>
        ))
      ) : (
        <Empty
          icon={BookOpen}
          title={docs ? "Your knowledge library" : "Opening the library…"}
          detail="Books added by Neem’s library administrator will appear here. Neem’s educational articles remain available in Education."
        />
      )}
    </>
  );
}
