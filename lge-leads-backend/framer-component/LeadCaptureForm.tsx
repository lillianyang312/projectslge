// LGE Lead Capture Form - Framer Code Component
// Copy this entire file into Framer: Assets Panel > Code > New Code Component

import { useState } from "react"
import { addPropertyControls, ControlType } from "framer"

// ============================================================
// CONFIGURATION - Update this URL after deploying to Vercel
// ============================================================
const API_ENDPOINT = "https://YOUR-PROJECT.vercel.app/api/lead"

// ============================================================
// TYPES
// ============================================================
type FormState = "idle" | "loading" | "success" | "error"
type MovingOption = "yes" | "no" | ""
type ApartmentSize = "studio" | "1br" | "2br" | "3br+" | ""

interface FormData {
    email: string
    moving_in_30_days: MovingOption
    apartment_size: ApartmentSize
    preferred_marketplaces: string[]
    notes: string
}

interface FormErrors {
    email?: string
    moving_in_30_days?: string
    apartment_size?: string
    preferred_marketplaces?: string
}

// ============================================================
// STYLES (matching Waitlister template aesthetic)
// ============================================================
const styles = {
    container: {
        width: "100%",
        maxWidth: "440px",
        fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    inputRow: {
        display: "flex",
        gap: "12px",
        marginBottom: "12px",
    },
    input: {
        flex: 1,
        padding: "14px 18px",
        fontSize: "15px",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "10px",
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#fff",
        outline: "none",
        transition: "border-color 0.2s, background-color 0.2s",
    },
    inputFocus: {
        borderColor: "rgba(255, 255, 255, 0.3)",
        backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    inputError: {
        borderColor: "#ff6b6b",
    },
    button: {
        padding: "14px 28px",
        fontSize: "15px",
        fontWeight: 600,
        border: "none",
        borderRadius: "10px",
        backgroundColor: "#fff",
        color: "#000",
        cursor: "pointer",
        transition: "transform 0.15s, opacity 0.15s",
        whiteSpace: "nowrap" as const,
    },
    buttonHover: {
        transform: "scale(0.98)",
        opacity: 0.9,
    },
    buttonDisabled: {
        opacity: 0.6,
        cursor: "not-allowed",
    },
    toggle: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        color: "rgba(255, 255, 255, 0.5)",
        cursor: "pointer",
        transition: "color 0.2s",
        background: "none",
        border: "none",
        padding: 0,
        marginTop: "4px",
    },
    toggleHover: {
        color: "rgba(255, 255, 255, 0.8)",
    },
    expandedSection: {
        marginTop: "20px",
        padding: "20px",
        backgroundColor: "rgba(255, 255, 255, 0.03)",
        borderRadius: "12px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
    },
    fieldGroup: {
        marginBottom: "18px",
    },
    label: {
        display: "block",
        fontSize: "13px",
        fontWeight: 500,
        color: "rgba(255, 255, 255, 0.7)",
        marginBottom: "8px",
    },
    select: {
        width: "100%",
        padding: "12px 14px",
        fontSize: "14px",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "8px",
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#fff",
        outline: "none",
        cursor: "pointer",
        appearance: "none" as const,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.5)' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
    },
    checkboxGroup: {
        display: "flex",
        flexWrap: "wrap" as const,
        gap: "10px",
    },
    checkboxLabel: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px",
        fontSize: "13px",
        color: "rgba(255, 255, 255, 0.8)",
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "8px",
        cursor: "pointer",
        transition: "background-color 0.2s, border-color 0.2s",
    },
    checkboxLabelSelected: {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
        borderColor: "rgba(255, 255, 255, 0.25)",
    },
    checkbox: {
        width: "16px",
        height: "16px",
        accentColor: "#fff",
    },
    textarea: {
        width: "100%",
        padding: "12px 14px",
        fontSize: "14px",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        borderRadius: "8px",
        backgroundColor: "rgba(255, 255, 255, 0.06)",
        color: "#fff",
        outline: "none",
        resize: "vertical" as const,
        minHeight: "80px",
        fontFamily: "inherit",
    },
    errorText: {
        fontSize: "12px",
        color: "#ff6b6b",
        marginTop: "6px",
    },
    successMessage: {
        padding: "16px 20px",
        fontSize: "15px",
        color: "#fff",
        backgroundColor: "rgba(74, 222, 128, 0.15)",
        borderRadius: "10px",
        textAlign: "center" as const,
    },
    errorMessage: {
        padding: "16px 20px",
        fontSize: "15px",
        color: "#fff",
        backgroundColor: "rgba(255, 107, 107, 0.15)",
        borderRadius: "10px",
        textAlign: "center" as const,
    },
}

// ============================================================
// COMPONENT
// ============================================================
export default function LeadCaptureForm(props: {
    apiEndpoint?: string
    buttonText?: string
    successText?: string
    errorText?: string
}) {
    const {
        apiEndpoint = API_ENDPOINT,
        buttonText = "Get started",
        successText = "Thanks — we'll reach out shortly.",
        errorText = "Something went wrong — try again.",
    } = props

    // State
    const [formState, setFormState] = useState<FormState>("idle")
    const [expanded, setExpanded] = useState(false)
    const [formData, setFormData] = useState<FormData>({
        email: "",
        moving_in_30_days: "",
        apartment_size: "",
        preferred_marketplaces: [],
        notes: "",
    })
    const [errors, setErrors] = useState<FormErrors>({})
    const [inputFocus, setInputFocus] = useState(false)
    const [buttonHover, setButtonHover] = useState(false)
    const [toggleHover, setToggleHover] = useState(false)

    // Validation
    const validateForm = (): boolean => {
        const newErrors: FormErrors = {}
        let valid = true

        // Email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!formData.email || !emailRegex.test(formData.email)) {
            newErrors.email = "Please enter a valid email"
            valid = false
        }

        // Moving in 30 days
        if (!formData.moving_in_30_days) {
            newErrors.moving_in_30_days = "Please select an option"
            valid = false
        }

        // Apartment size
        if (!formData.apartment_size) {
            newErrors.apartment_size = "Please select your apartment size"
            valid = false
        }

        // Marketplaces
        if (formData.preferred_marketplaces.length === 0) {
            newErrors.preferred_marketplaces =
                "Please select at least one marketplace"
            valid = false
        }

        setErrors(newErrors)
        return valid
    }

    // Check if details are filled
    const hasRequiredDetails = () => {
        return (
            formData.moving_in_30_days &&
            formData.apartment_size &&
            formData.preferred_marketplaces.length > 0
        )
    }

    // Handle submit
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // If details not filled, expand and show errors
        if (!hasRequiredDetails()) {
            setExpanded(true)
            validateForm()
            return
        }

        if (!validateForm()) {
            return
        }

        setFormState("loading")

        try {
            const response = await fetch(apiEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: formData.email.trim().toLowerCase(),
                    moving_in_30_days: formData.moving_in_30_days,
                    apartment_size: formData.apartment_size,
                    preferred_marketplaces: formData.preferred_marketplaces,
                    notes: formData.notes.trim() || undefined,
                }),
            })

            const data = await response.json()

            if (data.ok) {
                setFormState("success")
            } else {
                console.error("API error:", data.error)
                setFormState("error")
            }
        } catch (err) {
            console.error("Submit error:", err)
            setFormState("error")
        }
    }

    // Handle marketplace toggle
    const toggleMarketplace = (marketplace: string) => {
        setFormData((prev) => ({
            ...prev,
            preferred_marketplaces: prev.preferred_marketplaces.includes(
                marketplace
            )
                ? prev.preferred_marketplaces.filter((m) => m !== marketplace)
                : [...prev.preferred_marketplaces, marketplace],
        }))
        // Clear error when user makes selection
        if (errors.preferred_marketplaces) {
            setErrors((prev) => ({ ...prev, preferred_marketplaces: undefined }))
        }
    }

    // Success state
    if (formState === "success") {
        return (
            <div style={styles.container}>
                <div style={styles.successMessage}>{successText}</div>
            </div>
        )
    }

    // Error state (allow retry)
    if (formState === "error") {
        return (
            <div style={styles.container}>
                <div style={styles.errorMessage}>
                    {errorText}
                    <button
                        onClick={() => setFormState("idle")}
                        style={{
                            ...styles.toggle,
                            marginLeft: "12px",
                            color: "#fff",
                            textDecoration: "underline",
                        }}
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }

    const marketplaces = ["Facebook", "eBay", "Mercari", "Don't care"]

    return (
        <div style={styles.container}>
            <form onSubmit={handleSubmit}>
                {/* Email + Button Row */}
                <div style={styles.inputRow}>
                    <input
                        type="email"
                        placeholder="Your email"
                        value={formData.email}
                        onChange={(e) => {
                            setFormData((prev) => ({
                                ...prev,
                                email: e.target.value,
                            }))
                            if (errors.email)
                                setErrors((prev) => ({
                                    ...prev,
                                    email: undefined,
                                }))
                        }}
                        onFocus={() => setInputFocus(true)}
                        onBlur={() => setInputFocus(false)}
                        disabled={formState === "loading"}
                        style={{
                            ...styles.input,
                            ...(inputFocus ? styles.inputFocus : {}),
                            ...(errors.email ? styles.inputError : {}),
                        }}
                    />
                    <button
                        type="submit"
                        disabled={formState === "loading"}
                        onMouseEnter={() => setButtonHover(true)}
                        onMouseLeave={() => setButtonHover(false)}
                        style={{
                            ...styles.button,
                            ...(buttonHover && formState !== "loading"
                                ? styles.buttonHover
                                : {}),
                            ...(formState === "loading"
                                ? styles.buttonDisabled
                                : {}),
                        }}
                    >
                        {formState === "loading" ? "..." : buttonText}
                    </button>
                </div>

                {/* Email error */}
                {errors.email && (
                    <div style={styles.errorText}>{errors.email}</div>
                )}

                {/* Toggle */}
                <button
                    type="button"
                    onClick={() => setExpanded(!expanded)}
                    onMouseEnter={() => setToggleHover(true)}
                    onMouseLeave={() => setToggleHover(false)}
                    style={{
                        ...styles.toggle,
                        ...(toggleHover ? styles.toggleHover : {}),
                    }}
                >
                    <span
                        style={{
                            transform: expanded
                                ? "rotate(90deg)"
                                : "rotate(0deg)",
                            transition: "transform 0.2s",
                            display: "inline-block",
                        }}
                    >
                        →
                    </span>
                    {expanded ? "Hide details" : "More details"}
                </button>

                {/* Expanded Section */}
                {expanded && (
                    <div style={styles.expandedSection}>
                        {/* Moving in 30 days */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>
                                Moving in the next 30 days?
                            </label>
                            <select
                                value={formData.moving_in_30_days}
                                onChange={(e) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        moving_in_30_days: e.target
                                            .value as MovingOption,
                                    }))
                                    if (errors.moving_in_30_days)
                                        setErrors((prev) => ({
                                            ...prev,
                                            moving_in_30_days: undefined,
                                        }))
                                }}
                                style={{
                                    ...styles.select,
                                    ...(errors.moving_in_30_days
                                        ? styles.inputError
                                        : {}),
                                }}
                            >
                                <option value="">Select...</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                            {errors.moving_in_30_days && (
                                <div style={styles.errorText}>
                                    {errors.moving_in_30_days}
                                </div>
                            )}
                        </div>

                        {/* Apartment size */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>Apartment size</label>
                            <select
                                value={formData.apartment_size}
                                onChange={(e) => {
                                    setFormData((prev) => ({
                                        ...prev,
                                        apartment_size: e.target
                                            .value as ApartmentSize,
                                    }))
                                    if (errors.apartment_size)
                                        setErrors((prev) => ({
                                            ...prev,
                                            apartment_size: undefined,
                                        }))
                                }}
                                style={{
                                    ...styles.select,
                                    ...(errors.apartment_size
                                        ? styles.inputError
                                        : {}),
                                }}
                            >
                                <option value="">Select...</option>
                                <option value="studio">Studio</option>
                                <option value="1br">1 Bedroom</option>
                                <option value="2br">2 Bedrooms</option>
                                <option value="3br+">3+ Bedrooms</option>
                            </select>
                            {errors.apartment_size && (
                                <div style={styles.errorText}>
                                    {errors.apartment_size}
                                </div>
                            )}
                        </div>

                        {/* Preferred marketplaces */}
                        <div style={styles.fieldGroup}>
                            <label style={styles.label}>
                                Preferred marketplaces
                            </label>
                            <div style={styles.checkboxGroup}>
                                {marketplaces.map((mp) => {
                                    const isSelected =
                                        formData.preferred_marketplaces.includes(
                                            mp
                                        )
                                    return (
                                        <label
                                            key={mp}
                                            style={{
                                                ...styles.checkboxLabel,
                                                ...(isSelected
                                                    ? styles.checkboxLabelSelected
                                                    : {}),
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() =>
                                                    toggleMarketplace(mp)
                                                }
                                                style={styles.checkbox}
                                            />
                                            {mp}
                                        </label>
                                    )
                                })}
                            </div>
                            {errors.preferred_marketplaces && (
                                <div style={styles.errorText}>
                                    {errors.preferred_marketplaces}
                                </div>
                            )}
                        </div>

                        {/* Notes */}
                        <div style={{ ...styles.fieldGroup, marginBottom: 0 }}>
                            <label style={styles.label}>
                                Anything else? (optional)
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        notes: e.target.value,
                                    }))
                                }
                                placeholder="Special requests, timeline, etc."
                                style={styles.textarea}
                                maxLength={1000}
                            />
                        </div>
                    </div>
                )}
            </form>
        </div>
    )
}

// ============================================================
// FRAMER PROPERTY CONTROLS
// ============================================================
addPropertyControls(LeadCaptureForm, {
    apiEndpoint: {
        type: ControlType.String,
        title: "API Endpoint",
        defaultValue: API_ENDPOINT,
    },
    buttonText: {
        type: ControlType.String,
        title: "Button Text",
        defaultValue: "Get started",
    },
    successText: {
        type: ControlType.String,
        title: "Success Message",
        defaultValue: "Thanks — we'll reach out shortly.",
    },
    errorText: {
        type: ControlType.String,
        title: "Error Message",
        defaultValue: "Something went wrong — try again.",
    },
})
