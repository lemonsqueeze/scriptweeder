<?xml version="1.0"?>

<xsl:stylesheet version="1.0"
 xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

<xsl:output method="xml" omit-xml-declaration="yes"
 encoding="utf-8" indent="no"/>


<xsl:template match="/">
  <xsl:for-each select="widgets/*">

    <!-- create a <widget> element with the id of that node -->
    <xsl:call-template name="newline"></xsl:call-template>
    <xsl:element name="widget" use-attribute-sets="id"/>
    <xsl:call-template name="newline"></xsl:call-template>

    <!-- the actual widget -->
    <xsl:copy-of select="." />

  </xsl:for-each>
</xsl:template>


<!-- variable definitions -->

<!-- make it easy to parse ... -->
<xsl:template name="newline">
    <xsl:text >
    </xsl:text >
</xsl:template>

<xsl:attribute-set name="id">
  <xsl:attribute name="id">
    <xsl:value-of select="@id"/>
  </xsl:attribute>
</xsl:attribute-set>


</xsl:stylesheet>
