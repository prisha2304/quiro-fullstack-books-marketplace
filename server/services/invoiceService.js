const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const invoiceDir = path.join(__dirname, '../uploads/invoices');
if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true });
}

/**
 * Generate a clean, vector PDF invoice for an order.
 * @param {Object} orderData - Full order, buyer, seller and items data.
 * @returns {Promise<string>} - Absolute path to generated PDF.
 */
const generateInvoicePDF = async (orderData) => {
    const { order, items } = orderData;
    const invoiceNum = order.invoice_number || `INV-${new Date().getFullYear()}-${order.id.toString().padStart(6, '0')}`;
    const filename = `invoice_${order.id}_${Date.now()}.pdf`;
    const filePath = path.join(invoiceDir, filename);

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // Header Branding
        doc.fillColor('#35152F')
           .fontSize(22)
           .font('Helvetica-Bold')
           .text('QUIRO', 50, 50);

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#64748B')
           .text("Your Next Chapter Could Be Someone's First.", 50, 75)
           .text('Website: https://quiro.in | Support: help@quiro.in', 50, 88);

        // Invoice Title on Right
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor('#35152F')
           .text('TAX INVOICE', 380, 50, { align: 'right' });

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#0F172A')
           .text(`Invoice No: ${invoiceNum}`, 380, 72, { align: 'right' })
           .text(`Order ID: #QRO-${order.id}`, 380, 85, { align: 'right' })
           .text(`Date: ${new Date(order.created_at || Date.now()).toLocaleDateString('en-IN')}`, 380, 98, { align: 'right' });

        // Divider
        doc.strokeColor('#E2E8F0')
           .lineWidth(1)
           .moveTo(50, 120)
           .lineTo(545, 120)
           .stroke();

        // Customer & Seller Info Section
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#0F172A')
           .text('BILLED TO / SHIP TO:', 50, 135);

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#334155')
           .text(`Customer Name: ${order.buyer_name || 'Verified Buyer'}`, 50, 150)
           .text(`Email: ${order.buyer_email || 'buyer@quiro.in'}`, 50, 163)
           .text(`Shipping Address: ${order.shipping_address || 'Registered Reader Address'}`, 50, 176, { width: 220 });

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor('#0F172A')
           .text('FULFILLMENT DETAILS:', 320, 135);

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#334155')
           .text(`Seller / Hub: ${items[0]?.seller_name || 'QUIRO Official'}`, 320, 150)
           .text(`Payment Mode: Razorpay Online (Prepaid)`, 320, 163)
           .text(`Order Status: ${(order.status || 'CONFIRMED').toUpperCase()}`, 320, 176);

        // Divider
        doc.strokeColor('#E2E8F0')
           .lineWidth(1)
           .moveTo(50, 225)
           .lineTo(545, 225)
           .stroke();

        // Items Table Header
        let y = 240;
        doc.rect(50, y, 495, 22).fill('#F8FAFC');

        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor('#0F172A')
           .text('#', 60, y + 6)
           .text('Item Description', 85, y + 6)
           .text('Qty', 340, y + 6, { align: 'center', width: 40 })
           .text('Price (INR)', 400, y + 6, { align: 'right', width: 60 })
           .text('Total (INR)', 475, y + 6, { align: 'right', width: 60 });

        // Items Rows
        y += 26;
        let subtotal = 0;

        items.forEach((item, index) => {
            const qty = parseInt(item.quantity, 10) || 1;
            const price = parseFloat(item.price) || 0;
            const lineTotal = price * qty;
            subtotal += lineTotal;

            doc.fontSize(9)
               .font('Helvetica')
               .fillColor('#334155')
               .text(`${index + 1}`, 60, y)
               .text(`${item.title || 'Book'} by ${item.author || 'Author'}`, 85, y, { width: 245 })
               .text(`${qty}`, 340, y, { align: 'center', width: 40 })
               .text(`Rs. ${price.toFixed(2)}`, 400, y, { align: 'right', width: 60 })
               .text(`Rs. ${lineTotal.toFixed(2)}`, 475, y, { align: 'right', width: 60 });

            y += 24;
        });

        // Totals Calculation
        y = Math.max(y + 10, 360);

        doc.strokeColor('#E2E8F0')
           .lineWidth(1)
           .moveTo(300, y)
           .lineTo(545, y)
           .stroke();

        y += 10;
        const total = parseFloat(order.total_price) || subtotal;

        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#64748B')
           .text('Subtotal:', 340, y, { align: 'right', width: 100 })
           .text(`Rs. ${subtotal.toFixed(2)}`, 450, y, { align: 'right', width: 85 });

        y += 16;
        doc.text('GST / Taxes (Included):', 340, y, { align: 'right', width: 100 })
           .text(`Rs. ${(total * 0.05).toFixed(2)}`, 450, y, { align: 'right', width: 85 });

        y += 16;
        doc.text('Shipping & Delivery:', 340, y, { align: 'right', width: 100 })
           .text('FREE', 450, y, { align: 'right', width: 85 });

        y += 18;
        doc.rect(300, y, 245, 24).fill('#EFF6FF');

        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#1D4ED8')
           .text('Grand Total:', 310, y + 6)
           .text(`Rs. ${total.toFixed(2)}`, 440, y + 6, { align: 'right', width: 95 });

        // Bottom Guarantee & Stamp
        y += 60;
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#94A3B8')
           .text('Terms & Conditions:', 50, y)
           .text('1. This is a computer-generated tax invoice and does not require a physical signature.', 50, y + 12)
           .text('2. All transactions are protected under the QUIRO Buyer Protection & Secure Checkout Guarantee.', 50, y + 22)
           .text('3. For refunds or order assistance, visit quiro.in/orders or email help@quiro.in.', 50, y + 32);

        doc.end();

        stream.on('finish', () => resolve({ filePath, filename, invoiceNum }));
        stream.on('error', (err) => reject(err));
    });
};

module.exports = {
    generateInvoicePDF
};
