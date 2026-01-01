import { useState, useRef, useEffect } from "react"
import { addPropertyControls } from "framer"

const API_ENDPOINT = "https://projectslge-h19n.vercel.app/api/lead"

type FormState = "idle" | "loading" | "success" | "error"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LeadCaptureForm() {
    const [formState, setFormState] = useState<FormState>("idle")
    const [expanded, setExpanded] = useState(false)

    const [email, setEmail] = useState("")
    const [firstName, setFirstName] = useState("")
    const [lastName, setLastName] = useState("")
    const [neighborhood, setNeighborhood] = useState("")
    const [notes, setNotes] = useState("")

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [windowWidth, setWindowWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1200
    )

    const formRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth)
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [])

    useEffect(() => {
        if (expanded && formRef.current) {
            formRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
        }
    }, [expanded])

    const isPhone = windowWidth < 810
    const isTablet = windowWidth >= 810 && windowWidth < 1200
    const isDesktop = windowWidth >= 1200

    const validateEmail = () => {
        if (!email || !EMAIL_RE.test(email)) {
            setErrors((p) => ({ ...p, email: "Valid email required" }))
            return false
        }
        return true
    }

    const validateAll = () => {
        const newErrors: Record<string, string> = {}
        if (!email || !EMAIL_RE.test(email)) newErrors.email = "Valid email required"
        if (!firstName.trim()) newErrors.firstName = "Required"
        if (!lastName.trim()) newErrors.lastName = "Required"
        if (!neighborhood.trim()) newErrors.neighborhood = "Required"
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleGetStarted = (e: React.FormEvent) => {
        e.preventDefault()
        if (validateEmail()) setExpanded(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validateAll()) return

        setFormState("loading")

        // Your backend doesn't have a neighborhood field yet.
        // Put neighborhood + "why join" into notes so you don't lose it.
        const combinedNotes = [
            neighborhood.trim() ? `Neighborhood: ${neighborhood.trim()}` : "",
            notes.trim() ? `Why join: ${notes.trim()}` : "",
        ]
            .filter(Boolean)
            .join("\n")

        try {
            const res = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim().toLowerCase(),
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),

                    // REQUIRED by your backend schema (send defaults)
                    moving_in_30_days: "no",
                    apartment_size: "1br",
                    preferred_marketplaces: ["Let us decide"],

                    notes: combinedNotes,
                }),
            })

            const text = await res.text()
            let data: any = null
            try {
                data = JSON.parse(text)
            } catch {
                data = { ok: res.ok }
            }

            if (!res.ok) {
                console.log("LEAD SUBMIT status:", res.status)
                console.log("LEAD SUBMIT response:", text)
                setFormState("error")
                return
            }

            setFormState(data?.ok ? "success" : "error")
        } catch (err) {
            console.log("LEAD SUBMIT network error:", err)
            setFormState("error")
        }
    }

    const getStyles = () => {
        const base = { ...styles }

        if (isPhone) {
            base.wrapperExpanded = {
                ...base.wrapperExpanded,
                padding: "16px",
                overflowY: "auto" as const,
                WebkitOverflowScrolling: "touch" as const,
                height: "100%",
                maxHeight: "100vh",
            }
            base.containerExpanded = {
                ...base.containerExpanded,
                maxWidth: "100%",
                padding: "20px",
                borderRadius: "16px",
                marginBottom: "40px",
            }
            base.container = { ...base.container, maxWidth: "100%", padding: "0 16px" }
            base.nameRow = { ...base.nameRow, flexDirection: "column" as const, gap: "12px" }
            base.row = { ...base.row, flexDirection: "column" as const, gap: "12px" }
            base.button = { ...base.button, width: "100%" }
        } else if (isTablet) {
            base.containerExpanded = { ...base.containerExpanded, maxWidth: "650px" }
        } else if (isDesktop) {
            base.wrapperExpanded = { ...base.wrapperExpanded, padding: "40px 24px" }
            base.containerExpanded = { ...base.containerExpanded, maxWidth: "700px", padding: "40px" }
            base.container = { ...base.container, maxWidth: "500px" }
        }

        return base
    }

    const s = getStyles()

    if (formState === "success") {
        return (
            <div style={s.wrapper}>
                <div style={s.container}>
                    <div style={s.success}>🎉 Thanks — we&#39;ll reach out shortly!</div>
                </div>
            </div>
        )
    }

    if (formState === "error") {
        return (
            <div style={s.wrapper}>
                <div style={s.container}>
                    <div style={s.error}>
                        Something went wrong —
                        <button onClick={() => setFormState("idle")} style={s.retryBtn}>
                            try again
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!expanded) {
        return (
            <div style={s.wrapper}>
                <div style={s.container}>
                    <form onSubmit={handleGetStarted}>
                        <div style={s.row}>
                            <input
                                type="email"
                                placeholder="Your email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value)
                                    if (errors.email) setErrors((p) => ({ ...p, email: "" }))
                                }}
                                style={{ ...s.input, ...(errors.email ? s.inputError : {}) }}
                            />
                            <button type="submit" style={s.button}>
                                Get started
                            </button>
                        </div>
                        {errors.email && <div style={s.errorText}>{errors.email}</div>}
                    </form>
                </div>
            </div>
        )
    }

    return (
        <div ref={formRef} style={s.wrapperExpanded}>
            <div style={s.containerExpanded}>
                <form onSubmit={handleSubmit}>
                    <div style={s.fieldFullWidth}>
                        <label style={s.label}>Email *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value)
                                if (errors.email) setErrors((p) => ({ ...p, email: "" }))
                            }}
                            style={{ ...s.textInput, ...(errors.email ? s.inputError : {}) }}
                        />
                        {errors.email && <div style={s.errorText}>{errors.email}</div>}
                    </div>

                    <div style={s.nameRow}>
                        <div style={s.halfField}>
                            <label style={s.label}>First name *</label>
                            <input
                                type="text"
                                placeholder="First name"
                                value={firstName}
                                onChange={(e) => {
                                    setFirstName(e.target.value)
                                    if (errors.firstName) setErrors((p) => ({ ...p, firstName: "" }))
                                }}
                                style={{ ...s.textInput, ...(errors.firstName ? s.inputError : {}) }}
                            />
                            {errors.firstName && <div style={s.errorText}>{errors.firstName}</div>}
                        </div>

                        <div style={s.halfField}>
                            <label style={s.label}>Last name *</label>
                            <input
                                type="text"
                                placeholder="Last name"
                                value={lastName}
                                onChange={(e) => {
                                    setLastName(e.target.value)
                                    if (errors.lastName) setErrors((p) => ({ ...p, lastName: "" }))
                                }}
                                style={{ ...s.textInput, ...(errors.lastName ? s.inputError : {}) }}
                            />
                            {errors.lastName && <div style={s.errorText}>{errors.lastName}</div>}
                        </div>
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Neighborhood (SF) *</label>
                        <input
                            type="text"
                            placeholder="e.g., Mission, Hayes Valley, SoMa"
                            value={neighborhood}
                            onChange={(e) => {
                                setNeighborhood(e.target.value)
                                if (errors.neighborhood)
                                    setErrors((p) => ({ ...p, neighborhood: "" }))
                            }}
                            style={{ ...s.textInput, ...(errors.neighborhood ? s.inputError : {}) }}
                        />
                        {errors.neighborhood && (
                            <div style={s.errorText}>{errors.neighborhood}</div>
                        )}
                    </div>

                    <div style={s.field}>
                        <label style={s.label}>Notes (optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Why do you want to join Sellryte?"
                            style={s.textarea}
                            maxLength={1000}
                        />
                        <div style={s.helperText}>Why do you want to join Sellryte?</div>
                    </div>

                    <button type="submit" disabled={formState === "loading"} style={s.submitButton}>
                        {formState === "loading" ? "Submitting..." : "Join Sellryte"}
                    </button>

                    <button type="button" onClick={() => setExpanded(false)} style={s.toggleBack}>
                        ← Back
                    </button>
                </form>
            </div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    wrapper: {
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    wrapperExpanded: {
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        padding: "20px 24px",
        boxSizing: "border-box" as const,
        overflowY: "auto" as const,
        overflowX: "hidden" as const,
        WebkitOverflowScrolling: "touch",
    },
    container: {
        width: "100%",
        maxWidth: "440px",
        fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    containerExpanded: {
        width: "100%",
        maxWidth: "650px",
        fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(20px)",
        borderRadius: "20px",
        padding: "30px",
        boxSizing: "border-box" as const,
        border: "1px solid rgba(255,255,255,0.1)",
    },
    row: { display: "flex", gap: "12px", marginBottom: "8px" },
    nameRow: { display: "flex", gap: "16px", marginBottom: "18px" },
    halfField: { flex: 1 },
    field: { marginBottom: "18px" },
    fieldFullWidth: { marginBottom: "18px" },

    input: {
        flex: 1,
        padding: "14px 18px",
        fontSize: "15px",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "10px",
        backgroundColor: "rgba(255,255,255,0.1)",
        color: "#fff",
        outline: "none",
    },
    textInput: {
        width: "100%",
        padding: "12px 14px",
        fontSize: "14px",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "10px",
        backgroundColor: "rgba(255,255,255,0.1)",
        color: "#fff",
        outline: "none",
        boxSizing: "border-box" as const,
    },
    textarea: {
        width: "100%",
        padding: "12px 14px",
        fontSize: "14px",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "10px",
        backgroundColor: "rgba(255,255,255,0.1)",
        color: "#fff",
        outline: "none",
        resize: "vertical",
        minHeight: "70px",
        fontFamily: "inherit",
        boxSizing: "border-box" as const,
    },
    helperText: {
        marginTop: "8px",
        fontSize: "12px",
        color: "rgba(255,255,255,0.5)",
        lineHeight: "1.4",
    },

    inputError: { borderColor: "#ff6b6b" },

    button: {
        padding: "14px 28px",
        fontSize: "15px",
        fontWeight: 600,
        border: "none",
        borderRadius: "10px",
        backgroundColor: "#fff",
        color: "#000",
        cursor: "pointer",
        whiteSpace: "nowrap" as const,
    },
    submitButton: {
        width: "100%",
        padding: "16px 28px",
        fontSize: "16px",
        fontWeight: 700,
        border: "none",
        borderRadius: "12px",
        backgroundColor: "#fff",
        color: "#000",
        cursor: "pointer",
        marginTop: "4px",
        marginBottom: "12px",
    },
    toggleBack: {
        display: "block",
        width: "100%",
        textAlign: "center" as const,
        background: "none",
        border: "none",
        fontSize: "14px",
        color: "rgba(255,255,255,0.6)",
        cursor: "pointer",
        padding: "8px 0",
    },

    label: {
        display: "block",
        fontSize: "14px",
        fontWeight: 600,
        color: "#fff",
        marginBottom: "10px",
    },
    errorText: {
        fontSize: "12px",
        color: "#ff6b6b",
        marginTop: "6px",
        fontWeight: 500,
    },
    success: {
        padding: "24px",
        fontSize: "18px",
        fontWeight: 600,
        color: "#fff",
        backgroundColor: "rgba(34, 197, 94, 0.2)",
        borderRadius: "16px",
        textAlign: "center",
        border: "1px solid rgba(34, 197, 94, 0.3)",
    },
    error: {
        padding: "24px",
        fontSize: "16px",
        fontWeight: 500,
        color: "#fff",
        backgroundColor: "rgba(255,107,107,0.2)",
        borderRadius: "16px",
        textAlign: "center",
        border: "1px solid rgba(255, 107, 107, 0.3)",
    },
    retryBtn: {
        background: "none",
        border: "none",
        color: "#fff",
        textDecoration: "underline",
        cursor: "pointer",
        fontSize: "16px",
        fontWeight: 600,
        marginLeft: "4px",
    },
}

addPropertyControls(LeadCaptureForm, {})
